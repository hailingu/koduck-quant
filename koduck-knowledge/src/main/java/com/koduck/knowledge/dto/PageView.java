package com.koduck.knowledge.dto;

import java.util.List;

public record PageView<T>(List<T> items, int page, int size, long total) {
}
