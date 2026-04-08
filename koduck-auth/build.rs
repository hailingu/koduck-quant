use std::io::Result;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=proto/koduck/auth/v1/auth.proto");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .file_descriptor_set_path("src/grpc/proto/koduck.bin")
        .compile(&["proto/koduck/auth/v1/auth.proto"], &["proto"])?;

    Ok(())
}
