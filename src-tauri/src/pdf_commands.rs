
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

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

    if output.exists() {
        return Err(format!(
            "يوجد ملف بالفعل في مسار الإخراج:\n{}\n\
             لحماية الملفات، لن يتم استبداله. اختر اسمًا آخر.",
            output.display()
        ));
    }

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
        let canonical_parent = parent.canonicalize().ok()?;

        Some(canonical_parent.join(file_name))
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
// تشغيل Ghostscript المحلي
// ============================================================

async fn ghostscript(
    app: &AppHandle,
    args: Vec<String>,
) -> Result<(), String> {
    let output = app
        .shell()
        .sidecar("binaries/gs")
        .map_err(|e| {
            format!(
                "تعذر العثور على Ghostscript المحلي. \
                 تحقق من إعداد binaries/gs: {e}"
            )
        })?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("تعذر تشغيل Ghostscript: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr)
            .trim()
            .to_string();

        let stdout = String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_string();

        let details = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("رمز الخروج: {:?}", output.status.code())
        };

        return Err(format!("فشلت عملية Ghostscript: {details}"));
    }

    Ok(())
}

fn pdf_args(input: &str, output: &str) -> Vec<String> {
    vec![
        "-dSAFER".into(),
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-sDEVICE=pdfwrite".into(),
        format!("-o{output}"),
        "-f".into(),
        input.into(),
    ]
}

fn ensure_output(output: &str, allow_empty: bool) -> Result<(), String> {
    let path = Path::new(output);

    if !path.exists() || !path.is_file() {
        return Err(
            "انتهى البرنامج دون إنشاء ملف الإخراج المتوقع.".into(),
        );
    }

    let metadata = path
        .metadata()
        .map_err(|e| format!("تعذر التحقق من الملف الناتج: {e}"))?;

    if !allow_empty && metadata.len() == 0 {
        return Err("الملف الناتج فارغ؛ لم تُعتبر العملية ناجحة.".into());
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
    check_input(&input)?;
    check_output(&output)?;
    check_distinct_paths(&input, &output)?;

    let opts = options.unwrap_or(Value::Null);

    let dpi = option_i64(&opts, "dpi", 150).clamp(36, 1200);
    let level = option_string(&opts, "level", "balanced");

    let start_page = option_i64(&opts, "startPage", 1);

    if start_page < 1 {
        return Err("رقم صفحة البداية يجب أن يكون 1 أو أكبر.".into());
    }

    let end_page = option_i64(&opts, "endPage", i64::MAX);

    if end_page < start_page {
        return Err("صفحة النهاية يجب ألا تسبق صفحة البداية.".into());
    }

    let mut args: Vec<String>;
    let mut allow_empty_output = false;

    match operation {
        // ----------------------------------------------------
        // ضغط PDF
        // ----------------------------------------------------
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
                format!("-o{output}"),
                "-f".into(),
                input.clone(),
            ];
        }

        // ----------------------------------------------------
        // تغيير حجم الصفحات
        // ----------------------------------------------------
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
                _ => return Err("حجم الصفحة غير مدعوم.".into()),
            };

            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                format!("-sPAPERSIZE={paper}"),
                "-dFIXEDMEDIA".into(),
                "-dPDFFitPage".into(),
                format!("-o{output}"),
                "-f".into(),
                input.clone(),
            ];
        }

        // ----------------------------------------------------
        // تحويل الألوان
        // ----------------------------------------------------
        "convert_pdf_to_grayscale" => {
            args = pdf_args(&input, &output);
            args.insert(3, "-sColorConversionStrategy=Gray".into());
            args.insert(4, "-dProcessColorModel=/DeviceGray".into());
        }

        "convert_pdf_to_color" => {
            args = pdf_args(&input, &output);
            args.insert(3, "-sColorConversionStrategy=RGB".into());
        }

        // ----------------------------------------------------
        // استخراج صفحات أو تقسيم PDF
        // ----------------------------------------------------
        "split_pdf" | "extract_pdf_pages" => {
            args = pdf_args(&input, &output);
            args.insert(3, format!("-dFirstPage={start_page}"));

            if end_page != i64::MAX {
                args.insert(4, format!("-dLastPage={end_page}"));
            }
        }

        // ----------------------------------------------------
        // دمج ملفين
        // ----------------------------------------------------
        "merge_pdfs" => {
            let second = opts
                .get("secondInputPath")
                .and_then(Value::as_str)
                .ok_or("يلزم تحديد secondInputPath لدمج ملفين.")?;

            check_input(second)?;
            check_distinct_paths(second, &output)?;

            if same_file(&input, second) {
                return Err("اختر ملفين مختلفين لإجراء الدمج.".into());
            }

            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                format!("-o{output}"),
                "-f".into(),
                input.clone(),
                second.to_string(),
            ];
        }

        // ----------------------------------------------------
        // محاولة إصلاح PDF بإعادة كتابته
        // ----------------------------------------------------
        "repair_pdf" => {
            args = pdf_args(&input, &output);
        }

        // ----------------------------------------------------
        // تحسين العرض عبر الويب
        // ----------------------------------------------------
        "linearize_pdf" => {
            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=pdfwrite".into(),
                "-dFastWebView=true".into(),
                format!("-o{output}"),
                "-f".into(),
                input.clone(),
            ];
        }

        // ----------------------------------------------------
        // تشفير PDF
        // ----------------------------------------------------
        "encrypt_pdf" => {
            let user_password = opts
                .get("userPass")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .ok_or("يلزم تحديد كلمة مرور المستخدم.")?;

            let owner_password = opts
                .get("ownerPass")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .unwrap_or("MochaProOwner");

            let allow_print = opts
                .get("allowPrint")
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
                format!("-o{output}"),
                "-f".into(),
                input.clone(),
            ];
        }

        // ----------------------------------------------------
        // استخراج النص
        // ----------------------------------------------------
        "extract_pdf_text" => {
            args = vec![
                "-dSAFER".into(),
                "-dBATCH".into(),
                "-dNOPAUSE".into(),
                "-sDEVICE=txtwrite".into(),
                format!("-o{output}"),
                "-f".into(),
                input.clone(),
            ];

            // قد يكون ملف النص فارغًا إذا لم يحتوي PDF على نص قابل للاستخراج.
            allow_empty_output = true;
        }

        // ----------------------------------------------------
        // عمليات لم تنفذ بعد
        // ----------------------------------------------------
        _ => {
            return Err(format!(
                "العملية '{operation}' غير منفذة بعد. \
                 لم يتم إعلان نجاح أو إنشاء مخرجات مقصودة."
            ));
        }
    }

    ghostscript(&app, args).await?;
    ensure_output(&output, allow_empty_output)?;

    Ok(format!("اكتملت العملية بنجاح: {operation}"))
}

// ============================================================
// الأوامر العامة التي تستخدم محرك المعالجة
// ============================================================

macro_rules! command {
    ($name:ident) => {
        #[tauri::command]
        pub async fn $name(
            app: AppHandle,
            input_path: String,
            output_path: String,
            options: Option<Value>,
        ) -> Result<String, String> {
            process(
                app,
                stringify!($name),
                input_path,
                output_path,
                options,
            )
            .await
        }
    };
}

// ============================================================
// أوامر الواجهة القديمة
// ============================================================

#[tauri::command]
pub async fn execute_ghostscript_compress(
    app: AppHandle,
    input_path: String,
    output_path: String,
    level: String,
) -> Result<String, String> {
    process(
        app,
        "compress_pdf",
        input_path,
        output_path,
        Some(json!({ "level": level })),
    )
    .await
}

#[tauri::command]
pub async fn execute_ghostscript_organize(
    app: AppHandle,
    input_path: String,
    output_path: String,
    start_page: i64,
    end_page: i64,
) -> Result<String, String> {
    process(
        app,
        "split_pdf",
        input_path,
        output_path,
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
    input_path: String,
    output_path: String,
) -> Result<String, String> {
    check_input(&input_path)?;
    check_output(&output_path)?;
    check_distinct_paths(&input_path, &output_path)?;

    let args = vec![
        "-dSAFER".into(),
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-sDEVICE=txtwrite".into(),
        format!("-o{output_path}"),
        "-f".into(),
        input_path,
    ];

    ghostscript(&app, args).await?;
    ensure_output(&output_path, true)?;

    Ok("اكتمل استخراج النص.".into())
}

#[tauri::command]
pub async fn execute_ghostscript_encrypt(
    app: AppHandle,
    input_path: String,
    output_path: String,
    user_pass: String,
    owner_pass: String,
    allow_print: bool,
) -> Result<String, String> {
    process(
        app,
        "encrypt_pdf",
        input_path,
        output_path,
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
    _app: AppHandle,
    _input_path: String,
    _output_path: String,
    _compliance: String,
) -> Result<String, String> {
    Err(
        "تحويل PDF/A غير مفعّل. يلزم تنفيذ إعداد ملف تعريف PDF/A والتحقق من المطابقة."
            .into(),
    )
}

#[tauri::command]
pub async fn execute_ghostscript_merge(
    app: AppHandle,
    file_a: String,
    file_b: String,
    output_path: String,
) -> Result<String, String> {
    check_input(&file_a)?;
    check_input(&file_b)?;
    check_output(&output_path)?;
    check_distinct_paths(&file_a, &output_path)?;
    check_distinct_paths(&file_b, &output_path)?;

    if same_file(&file_a, &file_b) {
        return Err("اختر ملفين مختلفين لإجراء الدمج.".into());
    }

    let args = vec![
        "-dSAFER".into(),
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-sDEVICE=pdfwrite".into(),
        format!("-o{output_path}"),
        "-f".into(),
        file_a,
        file_b,
    ];

    ghostscript(&app, args).await?;
    ensure_output(&output_path, false)?;

    Ok("اكتمل دمج ملفات PDF.".into())
}

// ============================================================
// معلومات الملف: يستخدمها app/page.tsx لقياس الحجم
// ============================================================

#[tauri::command]
pub fn get_pdf_file_info(path: String) -> Result<Value, String> {
    check_path(&path, "مسار الملف")?;

    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("الملف غير موجود: {path}"));
    }

    if !file_path.is_file() {
        return Err("المسار المحدد ليس ملفًا عاديًا.".into());
    }

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("تعذر قراءة معلومات الملف: {e}"))?;

    let size_bytes = metadata.len();

    Ok(json!({
        "path": path,
        "sizeBytes": size_bytes,
        "exists": true,
        "isEmpty": size_bytes == 0
    }))
}

// ============================================================
// الأوامر المسجلة في lib.rs
// ملاحظة: وجود الأمر لا يعني أن وظيفته مدعومة في process.
// ============================================================

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
command!(merge_pdfs);
command!(split_pdf);
command!(reorder_pdf_pages);
command!(delete_pdf_pages);
command!(remove_blank_pdf_pages);
command!(extract_pdf_pages);
command!(add_pdf_watermark);
command!(encrypt_pdf);
command!(decrypt_pdf);
command!(set_pdf_permissions);
command!(add_pdf_signature);
command!(extract_pdf_text);
command!(repair_pdf);
command!(linearize_pdf);
command!(convert_pdf_to_pdfa);
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
// get_pdf_file_info له تنفيذ خاص أعلاه، لذلك لا يُنشأ باستخدام macro.
command!(optimize_pdf_fonts);
command!(optimize_pdf_images);
command!(remove_pdf_annotations);
command!(add_pdf_annotation);
command!(export_pdf_report);
