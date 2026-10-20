// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::api::process::Command;

// 🖨️ دالة حقن الأوامر الفيزيائية وسحق الـ 308 ميجا عبر المحرك المدمج
#[tauri::command]
async fn execute_ghostscript_compress(input_path: String, output_path: String, level: String) -> Result<String, String> {
    let gs_setting = match level.as_str() {
        "extreme" => "/screen",   // أقصى ضغط فيزيائي للبكسلات (72 DPI)
        "low" => "/printer",      // ضغط منخفض للحفاظ على الدقة الحادة (300 DPI)
        _ => "/ebook",            // الضغط المتوازن والمعياري للأجهزة (150 DPI)
    };

    // استدعاء المحرك المدمج سراً وتمرير المعاملات الرياضية الصارمة لأدوبي
    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&[
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            &format!("-dPDFSETTINGS={}", gs_setting),
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            &format!("-sOutputFile={}", output_path),
            &input_path,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok("تم سحق وهيكلة المستند فيزيائياً بنجاح!".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![execute_ghostscript_compress])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
