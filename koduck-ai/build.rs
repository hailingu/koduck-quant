use std::io::Result;

fn main() -> Result<()> {
    let proto_files = [
        "proto/koduck/contract/v1/shared.proto",
        "proto/koduck/memory/v1/memory.proto",
        "proto/koduck/tool/v1/tool.proto",
        "proto/koduck/llm/v1/llm.proto",
    ];

    for proto in &proto_files {
        println!("cargo:rerun-if-changed={proto}");
    }

    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR must be set by Cargo");
    let descriptor_path = std::path::Path::new(&out_dir).join("koduck_ai.bin");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .file_descriptor_set_path(descriptor_path)
        .compile(&proto_files, &["proto", "/usr/include"])?;

    Ok(())
}
