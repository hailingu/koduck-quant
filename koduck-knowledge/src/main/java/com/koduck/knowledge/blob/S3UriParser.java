package com.koduck.knowledge.blob;

import com.koduck.knowledge.exception.KnowledgeException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class S3UriParser {

    public BlobLocation parse(final String uri) {
        if (uri == null || uri.isBlank() || !uri.startsWith("s3://")) {
            throw new KnowledgeException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_S3_URI",
                    "Blob URI must be s3://<bucket>/<key>");
        }
        final String path = uri.substring("s3://".length());
        final int slashIndex = path.indexOf('/');
        if (slashIndex <= 0 || slashIndex == path.length() - 1) {
            throw new KnowledgeException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_S3_URI",
                    "Blob URI must contain a bucket and a key");
        }
        return new BlobLocation(uri, path.substring(0, slashIndex), path.substring(slashIndex + 1));
    }
}
