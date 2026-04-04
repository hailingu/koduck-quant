# ADR-0075: 移除 DataServiceClient.invokeRealtimeUpdate 中的阻塞式 .block()

- Status: Accepted
- Date: 2026-04-04
- Issue: #444

## Context

`ARCHITECTURE-EVALUATION.md` 将 `DataServiceClient.invokeRealtimeUpdate()` 中的 `.block()` 识别为关键缺陷：

1. **文档与实现不一致**：`triggerRealtimeUpdate` 的 Javadoc 声明这是 "an asynchronous operation - the method returns immediately"，但内部调用链最终执行了 `.block()`，导致调用线程被挂起等待 HTTP 响应。
2. **缺少超时控制**：`.block()` 未指定超时，若 data-service 网络抖动或挂死，调用线程可能被无限期阻塞。
3. **虚拟线程只能缓解，不能消除问题**：项目已启用 `spring.threads.virtual.enabled=true`，阻塞 I/O 时虚拟线程会卸载（unmount），但线程仍然被占用到响应返回为止，且异常场景下仍然影响吞吐。

## Decision

### 1. 将 .block() 替换为 .subscribe()

`invokeRealtimeUpdate` 是一个纯副作用（fire-and-forget）操作：调用方既不消费返回值，也不依赖其成功来继续后续业务逻辑。因此最自然的修复方式是使用 Reactor 的 `subscribe()` 启动异步请求，并立即返回。

### 2. 增加显式超时

通过 `.timeout(Duration.ofSeconds(5))` 为 WebClient 调用添加上限，避免远端无响应时长期占用资源。

### 3. 在 Reactor 操作符中处理日志与错误

- `.doOnSuccess(...)` 中记录 `realtime_update_triggered`
- `.doOnError(...)` 中记录 `realtime_update_trigger_failed`
- 错误通过 Reactor 的异步路径消费，不再抛回给 `triggerRealtimeUpdate`

### 4. 保持 CircuitBreaker 兼容性

Resilience4j 的 `@CircuitBreaker` 切面作用于 `triggerRealtimeUpdate(List<String>)`。修改为 `subscribe()` 后：
- 正常路径：立即返回，CircuitBreaker 统计为成功
- 异常路径：因为异常发生在订阅后的异步回调中，默认不会被 `@CircuitBreaker` 捕获。为了继续让熔断器生效，我们在 `subscribe()` 中提供一个显式的 `Consumer<Throwable>` 错误处理器，但更重要的是：**如果 WebClient 在订阅前配置阶段就抛异常（如 URI 非法），仍然会被切面捕获；而运行时网络错误则由 Reactor 的 `doOnError` + `subscribe(onError)` 处理**。权衡后认为：
  - 该方法的语义本身就是 "触发即可"，对熔断器的需求主要是防止连续同步阻塞拖垮系统；
  - 改为非阻塞后，即使远端偶发失败，对调用方线程的影响已大幅降低；
  - 若后续需要更精细的 CircuitBreaker + Reactor 集成，可引入 `resilience4j-reactor` 模块，但本次保持最小改动。

## Consequences

### 正向影响

- **真正的 fire-and-forget**：调用方线程立即返回，不再阻塞等待 HTTP 响应
- **超时保护**：5 秒超时防止远端挂死导致资源长期占用
- **文档与实现一致**：Javadoc 的 "asynchronous operation" 描述与实际行为对齐
- **更稳定的并发表现**：无论是否使用虚拟线程，都不会因 data-service 延迟而堆积等待线程

### 兼容性影响

- **无 API 变更**：`triggerRealtimeUpdate` 的签名（`void`）不变，所有调用方无需修改
- **行为微调**：成功/失败日志从同步阻塞后打印变为异步回调中打印，时间戳可能略有延后，但对业务逻辑无影响
- **CircuitBreaker 统计范围变化**：运行时网络异常不再进入 `@CircuitBreaker` fallback，而是由内部日志处理；若后续需要严格熔断，应升级为 `resilience4j-reactor`

## Alternatives Considered

1. **保留 .block()，仅添加 timeout 参数**
   - 拒绝：虽然缓解了无限阻塞，但仍然是同步调用，与 Javadoc 的 "asynchronous" 声明矛盾，且未根本解决线程占用问题
   - 当前方案：彻底改为非阻塞

2. **返回 Mono<Void>，让调用方决定订阅时机**
   - 拒绝：需要改动所有调用点（Controller/Service 层），传播 Reactive 类型到目前仍是 Servlet 阻塞模型的代码库中，改动面过大且收益不高
   - 当前方案：在 Client 内部 subscribe，保持现有 void 接口

3. **使用 @Async + 线程池**
   - 拒绝：引入额外的线程池管理复杂度，而 WebClient + Reactor 已经提供了更轻量的异步机制
   - 当前方案：直接使用 Reactor subscribe

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 新增/更新单元测试验证异步行为与超时配置
