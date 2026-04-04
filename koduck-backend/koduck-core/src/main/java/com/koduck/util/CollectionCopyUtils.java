package com.koduck.util;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Collection defensive copy helpers.
 *
 * @author GitHub Copilot
 */
public final class CollectionCopyUtils {

    private CollectionCopyUtils() {
    }

    /**
     * Creates an immutable defensive copy of the provided list.
     *
     * @param source source list
     * @param <T> element type
     * @return copied immutable list or null when source is null
     */
    public static <T> List<T> copyList(final List<T> source) {
        List<T> copied = null;
        if (source != null) {
            copied = List.copyOf(source);
        }
        return copied;
    }

    /**
     * Creates an immutable defensive copy of the provided map.
     *
     * @param source source map
     * @param <K> key type
     * @param <V> value type
     * @return copied immutable map or null when source is null
     */
    public static <K, V> Map<K, V> copyMap(final Map<K, V> source) {
        Map<K, V> copied = null;
        if (source != null) {
            copied = Map.copyOf(source);
        }
        return copied;
    }

    /**
     * Creates a defensive copy of the provided string array.
     *
     * @param source source array
     * @return copied array or null when source is null
     */
    public static String[] copyArray(final String... source) {
        String[] copied = null;
        if (source != null) {
            copied = Arrays.copyOf(source, source.length);
        }
        return copied;
    }
}