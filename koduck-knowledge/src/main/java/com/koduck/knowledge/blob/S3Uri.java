package com.koduck.knowledge.blob;

public record S3Uri(String bucket, String key) {

    public String toUri() {
        return "s3://" + bucket + "/" + key;
    }
}
