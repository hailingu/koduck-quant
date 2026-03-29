package com.koduck.repository;

import com.koduck.entity.MemoryChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemoryChatSessionRepository extends JpaRepository<MemoryChatSession, Long> {

    Optional<MemoryChatSession> findByUserIdAndSessionId(Long userId, String sessionId);

    List<MemoryChatSession> findByUserIdOrderByLastMessageAtDesc(Long userId);

    void deleteByUserIdAndSessionId(Long userId, String sessionId);
}
