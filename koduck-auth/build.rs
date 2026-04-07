use std::io::Result;

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=proto/koduck/auth/v1/auth.proto");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .out_dir("src/grpc/proto")
        .compile(&["proto/koduck/auth/v1/auth.proto"], &["proto"])?;

    Ok(())
}
