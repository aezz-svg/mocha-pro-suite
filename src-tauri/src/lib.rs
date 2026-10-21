
mod pdf_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pdf_commands::execute_ghostscript_compress,
            pdf_commands::execute_ghostscript_organize,
            pdf_commands::execute_ghostscript_extract_text,
            pdf_commands::execute_ghostscript_encrypt,
            pdf_commands::execute_ghostscript_pdfa,
            pdf_commands::execute_ghostscript_merge,
            pdf_commands::compress_pdf,
            pdf_commands::compress_pdf_extreme,
            pdf_commands::compress_pdf_web,
            pdf_commands::compress_pdf_custom_dpi,
            pdf_commands::resize_pdf,
            pdf_commands::scale_pdf,
            pdf_commands::set_pdf_page_size,
            pdf_commands::crop_pdf_margins,
            pdf_commands::rotate_pdf,
            pdf_commands::set_pdf_orientation,
            pdf_commands::optimize_pdf_for_screen,
            pdf_commands::optimize_pdf_for_print,
            pdf_commands::flatten_pdf,
            pdf_commands::merge_pdfs,
            pdf_commands::split_pdf,
            pdf_commands::reorder_pdf_pages,
            pdf_commands::delete_pdf_pages,
            pdf_commands::remove_blank_pdf_pages,
            pdf_commands::extract_pdf_pages,
            pdf_commands::add_pdf_watermark,
            pdf_commands::encrypt_pdf,
            pdf_commands::decrypt_pdf,
            pdf_commands::set_pdf_permissions,
            pdf_commands::add_pdf_signature,
            pdf_commands::extract_pdf_text,
            pdf_commands::repair_pdf,
            pdf_commands::linearize_pdf,
            pdf_commands::convert_pdf_to_pdfa,
            pdf_commands::convert_pdf_to_grayscale,
            pdf_commands::convert_pdf_to_monochrome,
            pdf_commands::convert_pdf_to_color,
            pdf_commands::get_pdf_metadata,
            pdf_commands::set_pdf_metadata,
            pdf_commands::remove_pdf_metadata,
            pdf_commands::get_pdf_page_count,
            pdf_commands::get_pdf_page_dimensions,
            pdf_commands::add_pdf_bookmarks,
            pdf_commands::remove_pdf_bookmarks,
            pdf_commands::validate_pdf,
            pdf_commands::sanitize_pdf,
            pdf_commands::create_pdf_from_images,
            pdf_commands::extract_pdf_images,
            pdf_commands::convert_pdf_to_images,
            pdf_commands::add_pdf_page_numbers,
            pdf_commands::add_pdf_header_footer,
            pdf_commands::deskew_pdf,
            pdf_commands::ocr_pdf,
            pdf_commands::compare_pdfs,
            pdf_commands::get_pdf_file_info,
            pdf_commands::optimize_pdf_fonts,
            pdf_commands::optimize_pdf_images,
            pdf_commands::remove_pdf_annotations,
            pdf_commands::add_pdf_annotation,
            pdf_commands::export_pdf_report
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run MochaPdfOptimizer");
}
