use std::io::Result;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=proto/koduck/contract/v1/shared.proto");
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR must be set by Cargo");
    let descriptor_path = std::path::Path::new(&out_dir).join("koduck_ai.bin");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .file_descriptor_set_path(descriptor_path)
        .compile(
            &["proto/koduck/contract/v1/shared.proto"],
            &["proto", "/usr/include"],
        )?;

    Ok(())
}
