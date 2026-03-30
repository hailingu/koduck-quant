package com.koduck.util;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Collection defensive copy helpers.
 */
public final class CollectionCopyUtils {

    private CollectionCopyUtils() {
    }

    public static <T> List<T> copyList(List<T> source) {
        return source == null ? null : List.copyOf(source);
    }

    public static <K, V> Map<K, V> copyMap(Map<K, V> source) {
        return source == null ? null : Map.copyOf(source);
    }

    public static String[] copyArray(String[] source) {
        return source == null ? null : Arrays.copyOf(source, source.length);
    }
}