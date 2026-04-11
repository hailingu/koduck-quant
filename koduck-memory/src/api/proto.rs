pub mod contract {
    tonic::include_proto!("koduck.contract.v1");
}

pub mod memory {
    tonic::include_proto!("koduck.memory.v1");
}

pub const FILE_DESCRIPTOR_SET: &[u8] =
    tonic::include_file_descriptor_set!("koduck_memory_descriptor");
