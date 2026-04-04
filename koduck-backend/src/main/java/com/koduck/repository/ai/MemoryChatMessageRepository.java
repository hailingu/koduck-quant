package com.koduck.repository.ai;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.MemoryChatMessage;

@Repository
public interface MemoryChatMessageRepository extends JpaRepository<MemoryChatMessage, Long> {

    List<MemoryChatMessage> findByUserIdAndSessionIdOrderByCreatedAtDesc(
        Long userId,
        String sessionId,
        Pageable pageable
    );

    void deleteByUserIdAndSessionId(Long userId, String sessionId);
}
