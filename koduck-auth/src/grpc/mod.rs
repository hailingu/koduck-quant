//! gRPC service layer

pub mod auth_service;
pub mod server;
pub mod token_service;

// Include generated proto code
pub mod proto {
    tonic::include_proto!("koduck.auth.v1");
    
    /// File descriptor set for gRPC reflection
    pub const FILE_DESCRIPTOR_SET: &[u8] = tonic::include_file_descriptor_set!("koduck");
}

pub use auth_service::GrpcAuthService;
pub use server::{create_grpc_services, create_and_run_grpc_server, GrpcServer};
pub use token_service::GrpcTokenService;
