package com.koduck.community.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.Instant;

/**
 * 评论创建事件。
 *
 * <p>当新评论被创建时发布。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Getter
public class CommentCreatedEvent extends ApplicationEvent {

    private static final long serialVersionUID = 1L;

    private final Long commentId;
    private final Long signalId;
    private final Long parentId;
    private final Long userId;
    private final String username;
    private final Instant occurredOn;

    /**
     * 创建评论创建事件。
     *
     * @param source 事件源
     * @param commentId 评论ID
     * @param signalId 信号ID
     * @param parentId 父评论ID（如果是回复）
     * @param userId 用户ID
     * @param username 用户名
     */
    public CommentCreatedEvent(Object source, Long commentId, Long signalId,
                               Long parentId, Long userId, String username) {
        super(source);
        this.commentId = commentId;
        this.signalId = signalId;
        this.parentId = parentId;
        this.userId = userId;
        this.username = username;
        this.occurredOn = Instant.now();
    }

    /**
     * 检查是否是回复。
     *
     * @return 是否是回复
     */
    public boolean isReply() {
        return parentId != null;
    }
}
