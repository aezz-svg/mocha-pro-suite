use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_shell::process::Output;
use tauri_plugin_shell::ShellExt;

// ============================================================
// تشخيص الأخطاء
// ============================================================

fn diagnostic_error(
    operation: &str,
    stage: &str,
    details: impl std::fmt::Display,
) -> String {
    format!(
        "فشلت العملية.\n\
         العملية: {operation}\n\
         المرحلة: {stage}\n\
         التفاصيل: {details}"
    )
}

// ============================================================
// التحقق من المسارات
// ============================================================

fn check_path(path: &str, label: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err(format!("{label} فارغ."));
    }

    if path.contains('\0') {
        return Err(format!("{label} يحتوي على محرف غير صالح."));
    }

    Ok(())
}

fn check_input(path: &str) -> Result<(), String> {
    check_path(path, "مسار الإدخال")?;

    let file = Path::new(path);

    if !file.exists() {
        return Err(format!("ملف الإدخال غير موجود: {path}"));
    }

    if !file.is_file() {
        return Err("مسار الإدخال ليس ملفًا عاديًا.".into());
    }

    Ok(())
}

fn check_output(path: &str) -> Result<(), String> {
    check_path(path, "مسار الإخراج")?;

    let output = Path::new(path);
    let parent = output
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));

    if !parent.exists() {
        return Err(format!(
            "مجلد الإخراج غير موجود: {}",
            parent.display()
        ));
    }

    if !parent.is_dir() {
        return Err("مجلد الإخراج المحدد ليس مجلدًا.".into());
    }

    // تم إزالة التحقق من وجود الملف مسبقًا للسماح بالكتابة فوقه إذا لزم الأمر،
    // ولكن تم الاحتفاظ بالتحقق من أن المسار مختلف عن الإدخال.
    // if output.exists() {
    //     return Err(format!(
    //         "يوجد ملف بالفعل في مسار الإخراج: {}. اختر اسمًا آخر.",
    //         output.display()
    //     ));
    // }

    Ok(())
}

fn same_file(first: &str, second: &str) -> bool {
    fn resolved_path(path: &str) -> Option<PathBuf> {
        let path = Path::new(path);

        if path.exists() {
            return path.canonicalize().ok();
        }

        let parent = path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));

        let file_name = path.file_name()?;
        Some(parent.canonicalize().ok()?.join(file_name))
    }

    let (Some(a), Some(b)) = (resolved_path(first), resolved_path(second)) else {
        #[cfg(windows)]
        {
            return first.eq_ignore_ascii_case(second);
        }

        #[cfg(not(windows))]
        {
            return first == second;
        }
    };

    #[cfg(windows)]
    {
        a.to_string_lossy()
            .eq_ignore_ascii_case(&b.to_string_lossy())
    }

    #[cfg(not(windows))]
    {
        a == b
    }
}

fn check_distinct_paths(input: &str, output: &str) -> Result<(), String> {
    if same_file(input, output) {
        return Err(
            "يجب أن يختلف مسار الإخراج عن مسار الإدخال لحماية الملف الأصلي."
                .into(),
        );
    }

    Ok(())
}

// ============================================================
// تشغيل Ghostscript مع تفاصيل التشخيص
// ============================================================

async fn ghostscript(
    app: &AppHandle,
    operation: &str,
    args: Vec<String>,
) -> Result<(), String> {
    // **التعديل هنا:** تم تغيير المسار إلى الاسم الأساسي لملف Ghostscript.
    // وظيفة sidecar ستضيف تلقائيًا لاحقة المعمارية وامتداد .exe على Windows.
    let command = app
        .shell()
        .sidecar("gs")
        .map_err(|e| {
            diagnostic_error(
                operation,
                "البحث عن Ghostscript",
                format!(
                    "تعذر العثور على البرنامج المحلي لـ Ghostscript في المسار المحدد (binaries/gs). \
                     تأكد من وجود الملف التنفيذي (مثل gs أو gs.exe) في مجلد binaries داخل src-tauri. الخطأ التقني: {e}"
                ),
            )
        })?;

    let output = command
        .args(args.clone())
        .output()
        .await
        .map_err(|e| {
            diagnostic_error(
                operation,
                "تشغيل Ghostscript",
                format!("تعذر بدء العملية. الخطأ الأصلي: {e}"),
            )
        })?;

    if output.status.success() {
        return Ok(());
    }

    let first_attempt = format_ghostscript_output(&output);

    // Ghostscript's legacy PDF interpreter can handle some malformed files
    // differently from the default interpreter. Retry only after a failed run.
    let mut fallback_args = vec!["-dNEWPDF=false".to_string()];
    fallback_args.extend(args);

    let fallback = app
        .shell()
        .sidecar("gs")
        .map_err(|e| {
            diagnostic_error(
                operation,
                "إعادة محاولة إصلاح PDF",
                format!("فشلت المحاولة بالمفسر الافتراضي: {first_attempt}\nتعذر تجهيز المحاولة بالمفسر القديم: {e}"),
            )
        })?
        .args(fallback_args)
        .output()
        .await
        .map_err(|e| {
            diagnostic_error(
                operation,
                "إعادة محاولة إصلاح PDF",
                format!("فشلت المحاولة بالمفسر الافتراضي: {first_attempt}\nتعذر تشغيل المحاولة بالمفسر القديم: {e}"),
            )
        })?;

    if fallback.status.success() {
        return Ok(());
    }

    Err(diagnostic_error(
        operation,
        "تنفيذ Ghostscript",
        format!(
            "فشلت المحاولة بالمفسر الافتراضي:\n{first_attempt}\n\
             وفشلت إعادة المحاولة بمفسر PDF القديم:\n{}",
            format_ghostscript_output(&fallback)
        ),
    ))
}

fn format_ghostscript_output(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    format!(
        "رمز الخروج: {:?}\nstderr:\n{}\nstdout:\n{}",
        output.status.code(),
        if stderr.trim().is_empty() { "(فارغ)" } else { stderr.trim() },
        if stdout.trim().is_empty() { "(فارغ)" } else { stdout.trim() },
    )
}

fn pdf_args(input: &str, output: &str) -> Vec<String> {
    vec![
        "-dSAFER".into(),
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-sDEVICE=pdfwrite".into(),
        format!("-sOutputFile={output}"),
        input.into(),
    ]
}

fn ensure_output(output: &str, allow_empty: bool) -> Result<(), String> {
    let path = Path::new(output);

    if !path.exists() || !path.is_file() {
        return Err(format!(
            "انتهى البرنامج دون إنشاء ملف الإخراج المتوقع: {output}"
        ));
    }

    let metadata = path.metadata().map_err(|e| {
        format!(
            "تعذر قراءة معلومات الملف الناتج '{output}': {e}"
        )
    })?;

    if !allow_empty && metadata.len() == 0 {
        return Err(format!(
            "الملف الناتج فارغ: {output}"
        ));
    }

    Ok(())
}

// ============================================================
// قراءة الخيارات
// ============================================================

fn option_string<'a>(
    opts: &'a Value,
    key: &str,
    default: &'a str,
) -> &'a str {
    opts.get(key)
        .and_then(Value::as_str)
        .unwrap_or(default)
}

fn option_i64(opts: &Value, key: &str, default: i64) -> i64 {
    opts.get(key)
        .and_then(Value::as_i64)
        .unwrap_or(default)
}

// ============================================================
// محرك معالجة PDF
// ============================================================

async fn process(
    app: AppHandle,
    operation: &str,
    input: String,
    output: String,
    options: Option<Value>,
) -> Result<String, String> {
    check_input(&input).map_err(|e| {
        diagnostic_error(operation, "التحقق من ملف الإدخال", e)
    })?;

    check_output(&output).map_err(|e| {
        diagnostic_error(operation, "التحقق من ملف الإخراج", e)
    })?;

    check_distinct_paths(&input, &output).map_err(|e| {
        diagnostic_error(operation, "التحقق من المسارات", e)
    })?;

    let opts = options.unwrap_or(Value::Null);
    let dpi = option_i64(&opts, "dpi", 150).clamp(36, 1200);
    let level = option_string(&opts, "level", "balanced");
    let start_page = option_i64(&opts, "startPage", 1);

    if start_page < 1 {
        return Err(diagnostic_error(
            operation,
            "التحقق من الخيارات",
            "رقم صفحة البداية يجب أن يكون 1 أو أكبر.",
        ));
    }

    let end_page = option_i64(&opts, "endPage", i64::MAX);

    if end_page < start_page {
        return Err(diagnostic_error(
            operation,
            "التحقق من الخيارات",
            "صفحة النهاية يجب ألا تسبق صفحة البداية.",
        ));
    }

    let mut args: Vec<String>;
    let mut allow_empty_output = false;

    match operation {
        "compress_pdf"
        | "compress_pdf_extreme"
        | "compress_pdf_web"
        | "compress_pdf_custom_dpi"
        | "optimize_pdf_for_screen"
        | "optimize_pdf_for_print"
        | "optimize_pdf_images"
        | "optimize_pdf_fonts" => {
            let preset = match operation {
                "compress_pdf_extreme" | "optimize_pdf_for_screen" => "/screen",
                "compress_pdf_web" => "/ebook",
                "optimize_pdf_for_print" | "optimize_pdf_fonts" => "/prepress",
                _ => match level {
                    "extreme" => "/screen",
                    "print" | "high" => "/prepress",
                    _ => "/ebook",
                },
            };

            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                format!("-dPDFSETTINGS={preset}"),
                "-dDownsampleColorImages=true".into(),
                format!("-dColorImageResolution={dpi}"),
                "-dDownsampleGrayImages=true".into(),
                format!("-dGrayImageResolution={dpi}"),
                "-dDownsampleMonoImages=true".into(),
                format!("-dMonoImageResolution={dpi}"),
                format!("-sOutputFile={output}"),
                input.clone(),
            ];
        }

        "resize_pdf" | "set_pdf_page_size" | "scale_pdf" => {
            let paper = option_string(&opts, "pageSize", "a4")
                .to_ascii_lowercase();

            let paper = match paper.as_str() {
                "a0" => "a0",
                "a1" => "a1",
                "a2" => "a2",
                "a3" => "a3",
                "a4" => "a4",
                "letter" => "letter",
                "legal" => "legal",
                _ => {
                    return Err(diagnostic_error(
                        operation,
                        "التحقق من الخيارات",
                        "حجم الصفحة غير مدعوم.",
                    ));
                }
            };

            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                format!("-sPAPERSIZE={paper}"),
                "-dFIXEDMEDIA".into(),
                "-dPDFFitPage".into(),
                format!("-sOutputFile={output}"),
                input.clone(),
            ];
        }

        "convert_pdf_to_grayscale" => {
            let mut a = pdf_args(&input, &output);
            a.insert(3, "-sColorConversionStrategy=Gray".into());
            a.insert(4, "-dProcessColorModel=/DeviceGray".into());
            args = a;
        }

        "convert_pdf_to_color" => {
            let mut a = pdf_args(&input, &output);
            a.insert(3, "-sColorConversionStrategy=RGB".into());
            args = a;
        }

        "split_pdf" | "extract_pdf_pages" => {
            let mut a = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                format!("-dFirstPage={start_page}"),
            ];

            if end_page != i64::MAX {
                a.push(format!("-dLastPage={end_page}"));
            }

            a.push(format!("-sOutputFile={output}"));
            a.push(input.clone());
            args = a;
        }

        "merge_pdfs" => {
            let mut inputs = vec![input.clone()];
            if let Some(paths) = opts.get("additionalInputPaths").and_then(Value::as_array) {
                for value in paths {
                    let path = value.as_str().ok_or_else(|| diagnostic_error(operation, "التحقق من الملفات", "مسار ملف الدمج غير صالح."))?;
                    check_input(path).map_err(|e| diagnostic_error(operation, "التحقق من الملف الإضافي", e))?;
                    if inputs.iter().any(|existing| same_file(existing, path)) {
                        return Err(diagnostic_error(operation, "التحقق من الملفات", "لا يمكن دمج الملف نفسه أكثر من مرة."));
                    }
                    check_distinct_paths(path, &output).map_err(|e| diagnostic_error(operation, "التحقق من المسارات", e))?;
                    inputs.push(path.to_string());
                }
            } else if let Some(second) = opts.get("secondInputPath").or_else(|| opts.get("second_input_path")).and_then(Value::as_str) {
                check_input(second).map_err(|e| diagnostic_error(operation, "التحقق من الملف الثاني", e))?;
                if same_file(&input, second) { return Err(diagnostic_error(operation, "التحقق من الملفات", "اختر ملفات مختلفة لإجراء الدمج.")); }
                check_distinct_paths(second, &output).map_err(|e| diagnostic_error(operation, "التحقق من المسارات", e))?;
                inputs.push(second.to_string());
            }
            if inputs.len() < 2 { return Err(diagnostic_error(operation, "التحقق من الخيارات", "اختر ملفين PDF على الأقل للدمج.")); }
            args = vec!["-dSAFER".into(), "-dBATCH".into(), "-dNOPAUSE".into(), "-sDEVICE=pdfwrite".into(), format!("-sOutputFile={output}")];
            args.extend(inputs);
        }

        "repair_pdf" | "linearize_pdf" => {
            let mut a = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
            ];

            if operation == "linearize_pdf" {
                a.push("-dFastWebView=true".into());
            }

            a.push(format!("-sOutputFile={output}"));
            a.push(input.clone());
            args = a;
        }

        "encrypt_pdf" => {
            let user_password = opts
                .get("userPass")
                .or_else(|| opts.get("user_pass")) // دعم التسمية المزدوجة
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    diagnostic_error(
                        operation,
                        "التحقق من خيارات التشفير",
                        "يلزم تحديد كلمة مرور المستخدم.",
                    )
                })?;

            let owner_password = opts
                .get("ownerPass")
                .or_else(|| opts.get("owner_pass")) // دعم التسمية المزدوجة
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .unwrap_or("MochaProOwner");

            let allow_print = opts
                .get("allowPrint")
                .or_else(|| opts.get("allow_print")) // دعم التسمية المزدوجة
                .and_then(Value::as_bool)
                .unwrap_or(false);

            let permissions = if allow_print { "-4" } else { "-1028" };

            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                "-dEncryptionR=3".into(),
                "-dKeyLength=128".into(),
                format!("-sUserPassword={user_password}"),
                format!("-sOwnerPassword={owner_password}"),
                format!("-dPermissions={permissions}"),
                format!("-sOutputFile={output}"),
                input.clone(),
            ];
        }

        "extract_pdf_text" => {
            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=txtwrite".into(),
                format!("-sOutputFile={output}"),
                input.clone(),
            ];
            allow_empty_output = true;
        }

        _ => {
            return Err(diagnostic_error(
                operation,
                "اختيار العملية",
                format!(
                    "العملية '{operation}' غير منفذة في محرك المعالجة الحالي. \
                     تسجيل الأمر في Tauri لا يعني أن وظيفته مكتملة."
                ),
            ));
        }
    }

    ghostscript(&app, operation, args).await?;

    ensure_output(&output, allow_empty_output).map_err(|e| {
        diagnostic_error(operation, "التحقق من النتيجة", e)
    })?;

    Ok(format!("اكتملت العملية بنجاح: {operation}"))
}

// ============================================================
// الأوامر العامة (تستخدم macro لتوليد الدوال)
// ============================================================

macro_rules! command {
    ($name:ident) => {
        #[tauri::command]
        pub async fn $name(
            app: AppHandle,
            // دعم كلا التسميتين: input_path و inputPath
            input_path: Option<String>,
            inputPath: Option<String>,
            // دعم كلا التسميتين: output_path و outputPath
            output_path: Option<String>,
            outputPath: Option<String>,
            options: Option<Value>,
        ) -> Result<String, String> {
            // اختيار المسار الصحيح بناءً على التسمية المتوفرة
            let input = input_path.or(inputPath).ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;
            let output = output_path.or(outputPath).ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;
            process(
                app,
                stringify!($name),
                input,
                output,
                options,
            )
            .await
        }
    };
}

// ============================================================
// أوامر الواجهة القديمة (مع دعم استقبال التسميتين لتفادي الأخطاء)
// ============================================================

#[tauri::command]
pub async fn execute_ghostscript_compress(
    app: AppHandle,
    params: Value,
) -> Result<String, String> {
    // دعم كلا التسميتين للمدخلات والمخرجات
    let input = params.get("inputPath")
        .or_else(|| params.get("input_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;

    let output = params.get("outputPath")
        .or_else(|| params.get("output_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;

    let compression_level = params.get("level")
        .and_then(Value::as_str)
        .unwrap_or("balanced");

    process(
        app,
        "compress_pdf",
        input.to_string(),
        output.to_string(),
        Some(json!({ "level": compression_level })),
    )
    .await
}

#[tauri::command]
pub async fn execute_ghostscript_organize(
    app: AppHandle,
    params: Value,
) -> Result<String, String> {
    // دعم كلا التسميتين للمدخلات والمخرجات
    let input = params.get("inputPath")
        .or_else(|| params.get("input_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;

    let output = params.get("outputPath")
        .or_else(|| params.get("output_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;

    // دعم كلا التسميتين للصفحات
    let start_page = params.get("startPage")
        .or_else(|| params.get("start_page"))
        .and_then(Value::as_i64)
        .unwrap_or(1);

    let end_page = params.get("endPage")
        .or_else(|| params.get("end_page"))
        .and_then(Value::as_i64)
        .unwrap_or(i64::MAX);

    process(
        app,
        "split_pdf",
        input.to_string(),
        output.to_string(),
        Some(json!({
            "startPage": start_page,
            "endPage": end_page
        })),
    )
    .await
}

#[tauri::command]
pub async fn execute_ghostscript_extract_text(
    app: AppHandle,
    // دعم كلا التسميتين للمدخلات والمخرجات
    input_path: Option<String>,
    inputPath: Option<String>,
    output_path: Option<String>,
    outputPath: Option<String>,
) -> Result<String, String> {
    let input = input_path.or(inputPath).ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;
    let output = output_path.or(outputPath).ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;

    check_input(&input)?;
    check_output(&output)?;
    check_distinct_paths(&input, &output)?;

    let args = vec![
        "-dSAFER".into(),
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-sDEVICE=txtwrite".into(),
        format!("-sOutputFile={output}"),
        input,
    ];

    ghostscript(&app, "execute_ghostscript_extract_text", args).await?;
    ensure_output(&output, true)?;

    Ok("اكتمل استخراج النص.".into())
}

#[tauri::command]
pub async fn execute_ghostscript_encrypt(
    app: AppHandle,
    params: Value,
) -> Result<String, String> {
    // دعم كلا التسميتين للمدخلات والمخرجات
    let input = params.get("inputPath")
        .or_else(|| params.get("input_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;

    let output = params.get("outputPath")
        .or_else(|| params.get("output_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;

    // دعم كلا التسميتين لكلمات المرور وخيارات الطباعة
    let user_pass = params.get("userPass")
        .or_else(|| params.get("user_pass"))
        .and_then(Value::as_str)
        .unwrap_or_default();

    let owner_pass = params.get("ownerPass")
        .or_else(|| params.get("owner_pass"))
        .and_then(Value::as_str)
        .unwrap_or("MochaProOwner");

    let allow_print = params.get("allowPrint")
        .or_else(|| params.get("allow_print"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    process(
        app,
        "encrypt_pdf",
        input.to_string(),
        output.to_string(),
        Some(json!({
            "userPass": user_pass,
            "ownerPass": owner_pass,
            "allowPrint": allow_print
        })),
    )
    .await
}

#[tauri::command]
pub async fn execute_ghostscript_pdfa(
    app: AppHandle, // تم إضافة app هنا لتمريرها إلى process
    // دعم كلا التسميتين للمدخلات والمخرجات
    input_path: Option<String>,
    inputPath: Option<String>,
    output_path: Option<String>,
    outputPath: Option<String>,
    // دعم كلا التسميتين للامتثال (compliance)
    compliance: Option<String>, // تم تغيير النوع ليكون Option<String> لدعم التسمية المزدوجة
    compliance_level: Option<String>, // تسمية إضافية لدعم التسمية المزدوجة
) -> Result<String, String> {
    // استخلاص قيمة الامتثال مع دعم كلا التسميتين
    let compliance_value = compliance.or(compliance_level).ok_or_else(|| {
        diagnostic_error(
            "execute_ghostscript_pdfa",
            "التحقق من المدخلات",
            "يلزم تحديد معيار الامتثال PDF/A.",
        )
    })?;

    // استخلاص المسارات مع دعم كلا التسميتين
    let input = input_path.or(inputPath).ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;
    let output = output_path.or(outputPath).ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;

    // التحقق من المسارات
    check_input(&input)?;
    check_output(&output)?;
    check_distinct_paths(&input, &output)?;

    // ملاحظة: تنفيذ PDF/A يتطلب إعدادات Ghostscript أكثر تعقيدًا وملفات تعريف ICC.
    // هذا التنفيذ هو مجرد placeholder كما كان في الكود الأصلي.
    // تم تعديل الاستدعاء ليكون ضمن process لتوحيد المعالجة
    process(
        app,
        "convert_pdf_to_pdfa", // اسم العملية
        input,
        output,
        Some(json!({ "compliance": compliance_value })), // تمرير الامتثال كخيار
    )
    .await
    .map_err(|e| { // تعديل رسالة الخطأ لتكون أكثر وضوحًا
        format!(
            "تحويل PDF/A إلى معيار '{}' غير مفعّل حاليًا؛ يلزم تنفيذ إعداد ملف تعريف PDF/A والتحقق من المطابقة.\n{}",
            compliance_value, e
        )
    })
}

#[tauri::command]
pub async fn execute_ghostscript_merge(
    app: AppHandle,
    // دعم كلا التسميتين للملفات
    file_a: String,
    file_b: String,
    // دعم كلا التسميتين للمخرجات
    output_path: Option<String>,
    outputPath: Option<String>,
) -> Result<String, String> {
    let output = output_path.or(outputPath).ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;
    check_input(&file_a)?;
    check_input(&file_b)?;
    check_output(&output)?;
    check_distinct_paths(&file_a, &output)?;
    check_distinct_paths(&file_b, &output)?;

    if same_file(&file_a, &file_b) {
        return Err("اختر ملفين مختلفين لإجراء الدمج.".into());
    }

    let args = vec![
        "-dSAFER".into(),
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-sDEVICE=pdfwrite".into(),
        format!("-sOutputFile={output}"),
        file_a,
        file_b,
    ];

    ghostscript(&app, "execute_ghostscript_merge", args).await?;
    ensure_output(&output, false)?;

    Ok("اكتمل دمج ملفات PDF.".into())
}

// ============================================================
// معلومات الملف
// ============================================================

// **التعديل هنا:** تم تغيير تعريف الدالة لاستقبال 'params: Value'
// ليتوافق مع رسالة الخطأ الجديدة التي تشير إلى البحث عن مفتاح 'params'.
#[tauri::command]
pub fn get_pdf_file_info(params: Value) -> Result<Value, String> {
    // استخلاص المسار من 'params' مع دعم كلا التسميتين
    let target_path = params.get("inputPath")
        .or_else(|| params.get("input_path"))
        .and_then(Value::as_str)
        .ok_or_else(|| "مسار الملف مفقود.".to_string())?;

    check_path(&target_path, "مسار الملف")?;

    let file_path = Path::new(&target_path);

    if !file_path.exists() {
        return Err(format!("الملف غير موجود: {target_path}"));
    }

    if !file_path.is_file() {
        return Err("المسار المحدد ليس ملفًا عاديًا.".into());
    }

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("تعذر قراءة معلومات الملف: {e}"))?;

    let size_bytes = metadata.len();
    let bytes = fs::read(file_path).map_err(|e| format!("تعذر قراءة الملف: {e}"))?;
    let text = String::from_utf8_lossy(&bytes);
    let page_objects = text.match_indices("/Type").filter(|(index, _)| {
        let tail = text[*index + 5..].trim_start();
        tail.starts_with("/Page") && !tail.starts_with("/Pages")
    }).count();
    let declared_pages = text.match_indices("/Count").filter_map(|(index, _)| {
        text[index + 6..].split_whitespace().next()?.parse::<u64>().ok()
    }).max().unwrap_or(0);
    let pages = (page_objects as u64).max(declared_pages);
    let version = text.get(..32).and_then(|head| head.find("%PDF-").map(|i| head[i + 5..].chars().take(3).collect::<String>())).unwrap_or_else(|| "N/A".into());
    let objects = text.matches(" obj").count() as u64;
    let images = text.matches("/Subtype /Image").count() as u64 + text.matches("/Subtype/Image").count() as u64;
    let fonts = text.matches("/Type /Font").count() as u64 + text.matches("/Type/Font").count() as u64;
    let producer = text.split("/Producer").nth(1).and_then(|tail| tail.split(['(', ')']).nth(1)).map(str::to_string);

    Ok(json!({
        "path": target_path,
        "sizeBytes": size_bytes,
        "exists": true,
        "isEmpty": size_bytes == 0,
        "pages": pages,
        "version": version,
        "encrypted": text.contains("/Encrypt"),
        "objects": objects,
        "images": images,
        "fonts": fonts,
        "hasForms": text.contains("/AcroForm"),
        "hasJavaScript": text.contains("/JavaScript") || text.contains("/JS "),
        "linearized": text.get(..2048).unwrap_or(&text).contains("/Linearized"),
        "producer": producer
    }))
}

#[tauri::command]
pub fn copy_pdf_file(inputPath: String, outputPath: String) -> Result<String, String> {
    check_input(&inputPath)?;
    check_output(&outputPath)?;
    check_distinct_paths(&inputPath, &outputPath)?;
    fs::copy(&inputPath, &outputPath).map_err(|e| format!("تعذر حفظ نسخة PDF: {e}"))?;
    Ok(format!("تم حفظ نسخة من الملف في {outputPath}"))
}

/// Rebuilds a PDF in the supplied page order by rendering each source page to a
/// temporary one-page PDF and asking Ghostscript to merge those pages in order.
#[tauri::command]
pub async fn reorder_pdf_pages(app: AppHandle, params: Value) -> Result<String, String> {
    let input = params.get("inputPath").or_else(|| params.get("input_path"))
        .and_then(Value::as_str).ok_or_else(|| "مسار الإدخال مفقود.".to_string())?;
    let output = params.get("outputPath").or_else(|| params.get("output_path"))
        .and_then(Value::as_str).ok_or_else(|| "مسار الإخراج مفقود.".to_string())?;
    let order = params.get("pageOrder").or_else(|| params.get("page_order"))
        .and_then(Value::as_array).ok_or_else(|| "قائمة ترتيب الصفحات مفقودة.".to_string())?;
    check_input(input)?;
    check_output(output)?;
    check_distinct_paths(input, output)?;
    if order.is_empty() { return Err("اختر صفحة واحدة على الأقل.".into()); }
    let mut pages = Vec::with_capacity(order.len());
    for value in order {
        let page = value.as_u64().filter(|n| *n > 0).ok_or_else(|| "رقم صفحة غير صالح في الترتيب.".to_string())? as u32;
        if pages.contains(&page) { return Err(format!("الصفحة {page} مكررة في ترتيب الصفحات.")); }
        pages.push(page);
    }

    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("تعذر إنشاء ملفات مؤقتة لإعادة الترتيب: {e}"))?.as_nanos();
    let mut parts: Vec<PathBuf> = Vec::with_capacity(pages.len());
    for (index, page) in pages.iter().enumerate() {
        let part = std::env::temp_dir().join(format!("mocha-reorder-{}-{stamp}-{index}.pdf", std::process::id()));
        let part_string = part.to_string_lossy().to_string();
        let args = vec![
            "-dSAFER".to_string(), "-dBATCH".to_string(), "-dNOPAUSE".to_string(),
            "-sDEVICE=pdfwrite".to_string(), format!("-dFirstPage={page}"),
            format!("-dLastPage={page}"), format!("-sOutputFile={part_string}"), input.to_string(),
        ];
        if let Err(error) = ghostscript(&app, "reorder_pdf_pages", args).await {
            for path in &parts { let _ = fs::remove_file(path); }
            let _ = fs::remove_file(&part);
            return Err(error);
        }
        if !part.is_file() {
            for path in &parts { let _ = fs::remove_file(path); }
            return Err(format!("تعذر إنشاء الصفحة {page} ضمن ملف إعادة الترتيب."));
        }
        parts.push(part);
    }

    let mut args = vec!["-dSAFER".to_string(), "-dBATCH".to_string(), "-dNOPAUSE".to_string(),
        "-sDEVICE=pdfwrite".to_string(), format!("-sOutputFile={output}")];
    args.extend(parts.iter().map(|path| path.to_string_lossy().to_string()));
    let result = ghostscript(&app, "reorder_pdf_pages", args).await;
    for path in &parts { let _ = fs::remove_file(path); }
    result?;
    Ok(format!("اكتملت إعادة ترتيب الصفحات وحُفظ الملف في {output}"))
}

/// Render one PDF page to a temporary PNG for the local page organizer UI.
/// The image is returned as bytes and the temporary file is deleted immediately.
#[tauri::command]
pub async fn render_pdf_page_thumbnail(
    app: AppHandle,
    inputPath: String,
    page: u32,
) -> Result<Vec<u8>, String> {
    check_input(&inputPath)?;
    if page == 0 { return Err("رقم الصفحة يجب أن يبدأ من 1.".into()); }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("تعذر إنشاء ملف المعاينة المؤقت: {e}"))?
        .as_nanos();
    let output = std::env::temp_dir().join(format!("mocha-page-preview-{stamp}.png"));
    let output_string = output.to_string_lossy().to_string();
    let args = vec![
        "-q".to_string(), "-dSAFER".to_string(), "-dBATCH".to_string(),
        "-dNOPAUSE".to_string(), "-sDEVICE=png16m".to_string(), "-r72".to_string(),
        format!("-dFirstPage={page}"), format!("-dLastPage={page}"),
        "-dAutoRotatePages=/None".to_string(), format!("-sOutputFile={output_string}"),
        inputPath,
    ];
    let result = app.shell().sidecar("gs")
        .map_err(|e| diagnostic_error("معاينة الصفحة", "البحث عن Ghostscript", e.to_string()))?
        .args(args).output().await
        .map_err(|e| diagnostic_error("معاينة الصفحة", "تشغيل Ghostscript", e.to_string()))?;
    if !result.status.success() {
        let _ = fs::remove_file(&output);
        return Err(diagnostic_error("معاينة الصفحة", "رسم PNG", format_ghostscript_output(&result)));
    }
    let bytes = fs::read(&output).map_err(|e| diagnostic_error("معاينة الصفحة", "قراءة الصورة", e.to_string()));
    let _ = fs::remove_file(&output);
    bytes
}
// ============================================================
// الأوامر المسجلة بالكامل (باستخدام macro)
// ============================================================

// هذه الأوامر تستخدم الـ macro `command!` الذي يدعم تلقائيًا
// كلا التسميتين للمدخلات والمخرجات (input_path/inputPath, output_path/outputPath)
// ويتم تمريرها إلى دالة `process` التي تتعامل مع منطق المعالجة.
command!(compress_pdf);
command!(compress_pdf_extreme);
command!(compress_pdf_web);
command!(compress_pdf_custom_dpi);
command!(resize_pdf);
command!(scale_pdf);
command!(set_pdf_page_size);
command!(crop_pdf_margins);
command!(rotate_pdf);
command!(set_pdf_orientation);
command!(optimize_pdf_for_screen);
command!(optimize_pdf_for_print);
command!(flatten_pdf);
command!(merge_pdfs); // تم تعديل هذه الدالة يدويًا لدعم تسميات مختلفة
command!(split_pdf);
command!(delete_pdf_pages);
command!(remove_blank_pdf_pages);
command!(extract_pdf_pages);
command!(add_pdf_watermark);
command!(encrypt_pdf); // تم تعديل هذه الدالة يدويًا لدعم تسميات مختلفة
command!(decrypt_pdf);
command!(set_pdf_permissions);
command!(add_pdf_signature);
command!(extract_pdf_text); // تم تعديل هذه الدالة يدويًا لدعم تسميات مختلفة
command!(repair_pdf);
command!(linearize_pdf);
command!(convert_pdf_to_pdfa); // تم تعديل هذه الدالة يدويًا لدعم تسميات مختلفة
command!(convert_pdf_to_grayscale);
command!(convert_pdf_to_monochrome);
command!(convert_pdf_to_color);
command!(get_pdf_metadata);
command!(set_pdf_metadata);
command!(remove_pdf_metadata);
command!(get_pdf_page_count);
command!(get_pdf_page_dimensions);
command!(add_pdf_bookmarks);
command!(remove_pdf_bookmarks);
command!(validate_pdf);
command!(sanitize_pdf);
command!(create_pdf_from_images);
command!(extract_pdf_images);
command!(convert_pdf_to_images);
command!(add_pdf_page_numbers);
command!(add_pdf_header_footer);
command!(deskew_pdf);
command!(ocr_pdf);
command!(compare_pdfs);
command!(optimize_pdf_fonts);
command!(optimize_pdf_images);
command!(remove_pdf_annotations);
command!(add_pdf_annotation);
command!(export_pdf_report);






