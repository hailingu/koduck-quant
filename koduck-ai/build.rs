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

    // 1. Compile shared.proto to generate contract types.
    //    tonic::include_proto! puts types directly at the module level (no sub-module wrapper).
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile(
            &["proto/koduck/contract/v1/shared.proto"],
            &["proto", "/usr/include"],
        )?;

    // 2. Compile service protos with extern_path for contract package.
    //    Points to crate::clients::proto where RequestMeta/ErrorDetail/Capability
    //    are directly available after include_proto!("koduck.contract.v1").
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .file_descriptor_set_path(descriptor_path)
        .extern_path(".koduck.contract.v1", "crate::clients::proto")
        .compile(
            &[
                "proto/koduck/memory/v1/memory.proto",
                "proto/koduck/tool/v1/tool.proto",
                "proto/koduck/llm/v1/llm.proto",
            ],
            &["proto", "/usr/include"],
        )?;

    Ok(())
}
