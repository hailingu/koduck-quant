use std::io::Result;

fn main() -> Result<()> {
    let proto_files = [
        "proto/koduck/contract/v1/shared.proto",
        "proto/koduck/memory/v1/memory.proto",
    ];

    for proto in &proto_files {
        println!("cargo:rerun-if-changed={proto}");
    }

    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR must be set by Cargo");
    let descriptor_path = std::path::Path::new(&out_dir).join("koduck_memory_descriptor.bin");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile(
            &["proto/koduck/contract/v1/shared.proto"],
            &["proto", "/usr/include"],
        )?;

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .file_descriptor_set_path(descriptor_path)
        .extern_path(".koduck.contract.v1", "crate::api::proto::contract")
        .compile(&["proto/koduck/memory/v1/memory.proto"], &["proto", "/usr/include"])?;

    Ok(())
}
