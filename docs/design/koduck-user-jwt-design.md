# Koduck-User 模块 JWT 设计方案

## 1. 架构演进：从单体到微服务

### 1.1 当前架构（单体应用）

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐
│   Client    │────▶│   APISIX    │────▶│   koduck-backend (单体)      │
└─────────────┘     └─────────────┘     │  ┌─────────┐  ┌─────────┐  │
                                        │  │koduck-  │  │koduck-  │  │
                                        │  │  auth   │  │  user   │  │
                                        │  └─────────┘  └─────────┘  │
                                        └─────────────────────────────┘
```

**特点**：
- 所有模块打包在一个 JAR 中
- 共享数据库连接池
- 部署简单，但扩展性受限

### 1.2 目标架构（微服务）

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────────────┐
│   Client    │────▶│   APISIX    │────▶│         业务服务（JWT 透传）          │
└─────────────┘     │  (网关+鉴权)  │     │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
                    │             │     │  │ market  │ │portfolio│ │  ...   │ │
                    │ • JWT 验签   │     │  └─────────┘ └─────────┘ └────────┘ │
                    │ • 路由转发   │     └─────────────────────────────────────┘
                    │ • 服务发现   │                    │
                    └──────┬──────┘                    │
                           │                           │
           ┌───────────────┼───────────────┐           │
           │               │               │           │
           ▼               ▼               ▼           │
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
    │koduck-auth  │ │koduck-user  │ │ 其他基础服务  │◀───┘
    │  (认证中心)  │ │  (用户管理)  │ │(market, etc)│
    └─────────────┘ └─────────────┘ └─────────────┘
```

**特点**：
- koduck-auth 和 koduck-user 作为独立服务部署
- APISIX 负责 JWT 验签和服务路由
- 各服务通过 JWT 透传获取用户身份

---

## 2. 服务拆分设计

### 2.1 服务边界划分

| 服务 | 职责 | 数据库 | 端口 |
|------|------|--------|------|
| `koduck-auth` | 登录、注册、Token 签发、公钥分发 | auth_db | 8081 |
| `koduck-user` | 用户信息、权限、角色管理 | user_db | 8082 |
| `koduck-gateway` (APISIX) | 路由、鉴权、限流、日志 | - | 9080 |
| `koduck-market` | 行情数据 | market_db | 8083 |
| `koduck-portfolio` | 投资组合 | portfolio_db | 8084 |
| ... | ... | ... | ... |

### 2.2 服务间通信

```
┌─────────────────────────────────────────────────────────────────┐
│                         服务间通信方式                           │
├─────────────────────────────────────────────────────────────────┤
│  同步调用 (Feign/WebClient)                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                     │
│  │  Business│───▶│  koduck │───▶│  koduck │                     │
│  │  Service │    │  -user  │    │  -auth  │ (Token 自省)        │
│  └─────────┘    └─────────┘    └─────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│  异步消息 (RabbitMQ/Kafka)                                       │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                     │
│  │koduck-  │───▶│  MQ     │───▶│koduck-  │                     │
│  │  auth   │    │         │    │  user   │                     │
│  └─────────┘    └─────────┘    └─────────┘                     │
│       (用户注册事件)                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. APISIX 服务发现配置

### 3.1 Kubernetes DNS 服务发现（推荐）

APISIX 原生支持通过 Kubernetes DNS 解析服务地址：

```yaml
# k8s/overlays/dev/apisix-route-init.yaml（微服务版）

# 1. koduck-auth 服务路由（公开）
echo "Registering koduck-auth service (public)"
curl -fsS -X PUT "${ADMIN}/routes/auth-service" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/auth/*",
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    }
  }'

# 2. koduck-user 服务路由（需 JWT 认证）
echo "Registering koduck-user service (protected)"
curl -fsS -X PUT "${ADMIN}/routes/user-service" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/users/*",
    "plugins": {
      "jwt-auth": {}
    },
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-user:8082": 1
      }
    }
  }'

# 3. 其他业务服务路由（需 JWT 认证）
echo "Registering business services"
curl -fsS -X PUT "${ADMIN}/routes/market-service" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/market/*",
    "plugins": {
      "jwt-auth": {}
    },
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-market:8083": 1
      }
    }
  }'
```

### 3.2 K8s Service 配置

每个微服务需要创建对应的 K8s Service，APISIX 通过 Service DNS 名访问：

```yaml
# k8s/base/koduck-auth-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: koduck-auth
  namespace: koduck
spec:
  type: ClusterIP
  selector:
    app: koduck-auth
  ports:
    - port: 8081
      targetPort: 8081
      name: http
```

```yaml
# k8s/base/koduck-user-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: koduck-user
  namespace: koduck
spec:
  type: ClusterIP
  selector:
    app: koduck-user
  ports:
    - port: 8082
      targetPort: 8082
      name: http
```

```yaml
# k8s/base/koduck-market-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: koduck-market
  namespace: koduck
spec:
  type: ClusterIP
  selector:
    app: koduck-market
  ports:
    - port: 8083
      targetPort: 8083
      name: http
```

### 3.3 服务发现工作原理

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   APISIX    │────▶│  K8s DNS (CoreDNS)                       │
│             │     │                                          │
│ koduck-auth:8081  │  koduck-auth.koduck.svc.cluster.local    │
│                   │       │                                  │
│                   │       ▼                                  │
│                   │  ┌─────────────────┐                     │
│                   │  │  koduck-auth    │                     │
│                   │  │  Pod IP: 10.0.1 │                     │
│                   │  └─────────────────┘                     │
└─────────────┘     └──────────────────────────────────────────┘
```

**DNS 解析规则**：
- 短名称：`koduck-auth:8081`
- 完整 DNS：`koduck-auth.koduck.svc.cluster.local:8081`
- 跨命名空间：`koduck-auth.other-namespace.svc.cluster.local:8081`

### 3.4 健康检查配置

APISIX 配合 K8s 健康检查实现自动剔除故障实例：

```yaml
# k8s/base/koduck-auth-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: koduck-auth
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: koduck-auth
          image: koduck-auth:latest
          ports:
            - containerPort: 8081
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8081
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8081
            initialDelaySeconds: 10
            periodSeconds: 5
```

**工作流程**：
1. K8s 通过 readinessProbe 检测 Pod 是否就绪
2. 未就绪的 Pod 从 Service Endpoints 中移除
3. APISIX 通过 DNS 解析获取可用 Pod IP
4. 故障实例自动隔离，流量不中断

### 3.5 本地开发环境配置

非 K8s 环境使用静态 IP 或 Docker Compose 服务名：

```yaml
# docker-compose.local.yml
version: '3.8'
services:
  apisix:
    image: apache/apisix:3.9.0
    environment:
      - APISIX_STAND_ALONE=true
    volumes:
      - ./apisix/conf.yaml:/usr/local/apisix/conf/config.yaml
    depends_on:
      - koduck-auth
      - koduck-user

  koduck-auth:
    build: ./koduck-backend/koduck-auth
    ports:
      - "8081:8081"

  koduck-user:
    build: ./koduck-backend/koduck-user
    ports:
      - "8082:8082"
```

```yaml
# apisix/conf.yaml (本地环境静态配置)
upstreams:
  - id: koduck-auth
    nodes:
      "koduck-auth:8081": 1
    type: roundrobin

  - id: koduck-user
    nodes:
      "koduck-user:8082": 1
    type: roundrobin
```

---

## 4. 独立服务的 JWT 架构

### 4.1 完整架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              客户端请求                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              APISIX 网关                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   jwt-auth      │  │  proxy-rewrite  │  │      服务发现            │  │
│  │                 │  │                 │  │                         │  │
│  │ • RS256 验签     │  │ • X-User-Id    │  │ • koduck-auth:8081     │  │
│  │ • 公钥验证       │  │ • X-Username   │  │ • koduck-user:8082     │  │
│  │ • Token 过期检查 │  │ • X-Roles      │  │ • koduck-market:8083   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌───────────────────────┐ ┌───────────────┐ ┌───────────────────────┐
│     koduck-auth       │ │  koduck-user  │ │    Business Service   │
│      (认证中心)        │ │   (用户管理)   │ │    (market, etc.)     │
│                       │ │               │ │                       │
│  ┌─────────────────┐  │ │  ┌─────────┐  │ │  ┌─────────────────┐  │
│  │  /auth/login    │  │ │  │ /users  │  │ │  │ /market/*       │  │
│  │  /auth/register │  │ │  │ /roles  │  │ │  │ /portfolio/*    │  │
│  │  /auth/refresh  │  │ │  │ /perms  │  │ │  │ ...             │  │
│  │  /.well-known/  │  │ │  └─────────┘  │ │  └─────────────────┘  │
│  │     jwks.json   │  │ │               │ │                       │
│  └─────────────────┘  │ │               │ │                       │
│                       │ │               │ │                       │
│  • RS256 私钥签名      │ │               │ │  • 从 Header 读取用户   │
│  • Token 签发         │ │               │ │  • 业务逻辑处理         │
│  • 公钥分发 (JWKS)    │ │               │ │  • 无需 JWT 解析        │
└───────────────────────┘ └───────────────┘ └───────────────────────┘
```

### 4.2 服务职责划分

| 服务 | JWT 相关职责 | 说明 |
|------|-------------|------|
| **koduck-auth** | Token 签发、私钥管理、公钥分发 | 唯一持有私钥的服务 |
| **APISIX** | Token 验证、身份透传 | 使用公钥验签，不解析业务逻辑 |
| **koduck-user** | 用户信息查询、权限管理 | 接收透传的用户身份 |
| **其他服务** | 业务逻辑 | 从 Header 获取用户身份 |

---

## 5. 服务间认证方案：APISIX key-auth

在 APISIX 环境下，服务间调用（如 koduck-user 调用 koduck-auth）采用 **key-auth** 插件进行认证。核心思路是将调用方服务虚拟化为 APISIX 的 "Consumer"，由 APISIX 统一处理服务间认证。

### 5.1 架构说明

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     服务间调用认证流程（经 APISIX）                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    1. 携带 API Key    ┌─────────────┐   2. 验证 Key   │
│  │ koduck-user │ ────────────────────▶│   APISIX    │ ───────────────▶│
│  │             │  apikey: uk_xxx      │             │  匹配 Consumer  │
│  │             │                      │ • key-auth  │                 │
│  │             │ ◀─────────────────── │ • 路由转发   │                 │
│  │             │    4. 返回响应        │             │   3. 透传请求   │
│  └─────────────┘                      └──────┬──────┘ ───────────────▶│
│                                              │                         │
│                                              ▼                         │
│                                       ┌─────────────┐                  │
│                                       │ koduck-auth │                  │
│                                       │             │                  │
│                                       │ • 处理请求   │                  │
│                                       │ • 返回数据   │                  │
│                                       └─────────────┘                  │
│                                                                         │
│  说明：                                                                  │
│  • 服务间调用经过 APISIX，复用网关的认证能力                              │
│  • koduck-user 作为 Consumer，使用 apikey 认证                            │
│  • koduck-auth 无需实现认证逻辑，专注业务处理                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 配置步骤

#### 步骤 1：将 koduck-user 注册为 Consumer

```bash
# 创建 koduck-user-consumer，分配内部调用 API Key
curl -fsS -X PUT "http://apisix-admin:9180/apisix/admin/consumers/koduck-user-consumer" \
  -H "X-API-KEY: ${ADMIN_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "koduck-user-consumer",
    "plugins": {
      "key-auth": {
        "key": "uk_a1b2c3d4e5f6789012345678"
      }
    }
  }'
```

#### 步骤 2：保护 koduck-auth 内部 API 路由

```bash
# 创建指向 koduck-auth 的内部 API 路由，开启 key-auth
curl -fsS -X PUT "http://apisix-admin:9180/apisix/admin/routes/auth-internal-api" \
  -H "X-API-KEY: ${ADMIN_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "uri": "/internal/*",
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    },
    "plugins": {
      "key-auth": {}
    }
  }'
```

**关键配置说明**：
- `uri`: `/internal/*` - 只保护内部 API 路径
- `plugins.key-auth`: 开启 key-auth 插件，要求请求携带 apikey
- 未携带 apikey 或 key 错误的请求，APISIX 直接返回 401

#### 步骤 3：koduck-user 发起带认证的请求

```java
@Component
public class AuthServiceClient {
    
    @Value("${internal.api-key}")
    private String apiKey;
    
    @Value("${internal.apisix-url}")
    private String apisixUrl;
    
    @Autowired
    private RestTemplate restTemplate;
    
    /**
     * 调用 koduck-auth 内部 API 获取用户信息
     */
    public UserInfo getUserInfo(Long userId) {
        HttpHeaders headers = new HttpHeaders();
        // 在 Header 中添加 apikey
        headers.set("apikey", apiKey);
        
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        
        // 请求地址指向 APISIX（而非直接访问 koduck-auth）
        ResponseEntity<UserInfo> response = restTemplate.exchange(
            apisixUrl + "/internal/users/{userId}",
            HttpMethod.GET,
            entity,
            UserInfo.class,
            userId
        );
        
        return response.getBody();
    }
    
    /**
     * 调用 koduck-auth 验证 Token
     */
    public TokenValidationResult validateToken(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", apiKey);
        
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(
            Map.of("token", token),
            headers
        );
        
        ResponseEntity<TokenValidationResult> response = restTemplate.exchange(
            apisixUrl + "/internal/tokens/validate",
            HttpMethod.POST,
            entity,
            TokenValidationResult.class
        );
        
        return response.getBody();
    }
}
```

#### 步骤 4：APISIX 验证并透传

```yaml
# APISIX 验证通过后，可选注入 Consumer 信息到 Header
plugins:
  key-auth: {}
  proxy-rewrite:
    headers:
      # 将 Consumer 名称透传给后端
      X-Consumer-Username: $consumer_name
      # 移除 apikey，避免后端感知
      apikey: ""
```

### 5.3 koduck-auth 内部 API 实现

koduck-auth 无需实现认证逻辑，专注业务处理：

```java
@RestController
@RequestMapping("/internal")
public class InternalAuthController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    /**
     * 查询用户信息
     * 注意：此接口已被 APISIX key-auth 保护，到达这里的请求都已通过认证
     */
    @GetMapping("/users/{userId}")
    public UserInfo getUserInfo(
            @PathVariable Long userId,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        
        // 可选：记录调用方
        log.info("Consumer [{}] querying user info: {}", consumer, userId);
        
        return userService.findById(userId)
            .map(this::toUserInfo)
            .orElseThrow(() -> new UserNotFoundException(userId));
    }
    
    /**
     * 验证 Token 有效性
     */
    @PostMapping("/tokens/validate")
    public TokenValidationResult validateToken(
            @RequestParam String token,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        
        log.info("Consumer [{}] validating token", consumer);
        
        try {
            Claims claims = jwtUtil.parseToken(token);
            return TokenValidationResult.builder()
                .valid(true)
                .userId(Long.valueOf(claims.getSubject()))
                .username(claims.get("username", String.class))
                .roles(claims.get("roles", List.class))
                .expiresAt(claims.getExpiration().toInstant())
                .build();
        } catch (JwtException e) {
            return TokenValidationResult.builder()
                .valid(false)
                .errorMessage(e.getMessage())
                .build();
        }
    }
}
```

### 5.4 完整配置示例

```yaml
# k8s/overlays/dev/apisix-route-init.yaml（服务间认证版）

# 1. 注册 koduck-user 为 Consumer
echo "Registering koduck-user as Consumer"
curl -fsS -X PUT "${ADMIN}/consumers/koduck-user-consumer" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d "{
    \"username\": \"koduck-user-consumer\",
    \"plugins\": {
      \"key-auth\": {
        \"key\": \"${INTERNAL_API_KEY_USER}\"
      }
    }
  }"

# 2. 创建 koduck-auth 内部 API 路由（key-auth 保护）
echo "Registering koduck-auth internal API (key-auth protected)"
curl -fsS -X PUT "${ADMIN}/routes/auth-internal-api" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/internal/*",
    "priority": 100,
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    },
    "plugins": {
      "key-auth": {},
      "proxy-rewrite": {
        "headers": {
          "X-Consumer-Username": "$consumer_name",
          "apikey": ""
        }
      }
    }
  }'

# 3. 创建 koduck-auth 公开 API 路由（无需认证）
echo "Registering koduck-auth public API"
curl -fsS -X PUT "${ADMIN}/routes/auth-public-api" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/auth/*",
    "priority": 90,
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    }
  }'
```

### 5.5 环境变量配置

```bash
# K8s Secret（唯一推荐方式）

# koduck-user 的 K8s Secret 配置示例
# 实际值存储在 K8s Secret 中，通过环境变量注入

# Secret 定义（k8s/base/koduck-user-secret.yaml）
apiVersion: v1
kind: Secret
metadata:
  name: koduck-user-internal
  namespace: koduck
type: Opaque
stringData:
  INTERNAL_API_KEY: "uk_a1b2c3d4e5f6789012345678"
  INTERNAL_APISIX_URL: "http://apisix-gateway:9080"

# Deployment 中引用（k8s/base/koduck-user-deployment.yaml）
spec:
  containers:
    - name: koduck-user
      envFrom:
        - secretRef:
            name: koduck-user-internal
```

### 5.6 安全注意事项

| 项目 | 说明 |
|------|------|
| **API Key 生成** | 使用 `openssl rand -hex 16` 生成 32 位随机字符串 |
| **Key 存储** | **K8s Secret**，禁止硬编码 |
| **Key 轮换** | 建议 90 天轮换一次，支持双 Key 并行期 |
| **传输安全** | 服务间调用使用 HTTP（集群内部），外部使用 HTTPS |
| **审计日志** | APISIX 记录所有 key-auth 认证日志 |
| **最小权限** | 每个服务只分配必要的内部 API 访问权限 |

---

### 5.7 K8s Secret 配置示例

```yaml
# k8s/base/koduck-user-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: koduck-user-internal
  namespace: koduck
type: Opaque
stringData:
  INTERNAL_API_KEY: "uk_a1b2c3d4e5f6789012345678"
  INTERNAL_APISIX_URL: "http://apisix-gateway:9080"
---
# k8s/base/koduck-market-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: koduck-market-internal
  namespace: koduck
type: Opaque
stringData:
  INTERNAL_API_KEY: "mk_b2c3d4e5f6g7890123456789"
  INTERNAL_APISIX_URL: "http://apisix-gateway:9080"
```

---

### 5.8 K8s 网络策略（可选）

```yaml
# k8s/base/koduck-auth-network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: koduck-auth-internal
  namespace: koduck
spec:
  podSelector:
    matchLabels:
      app: koduck-auth
  policyTypes:
    - Ingress
  ingress:
    # 允许来自 koduck-user 的访问
    - from:
        - podSelector:
            matchLabels:
              app: koduck-user
      ports:
        - protocol: TCP
          port: 8081
    # 允许来自 koduck-market 的访问
    - from:
        - podSelector:
            matchLabels:
              app: koduck-market
      ports:
        - protocol: TCP
          port: 8081
    # 允许来自 APISIX 的访问
    - from:
        - podSelector:
            matchLabels:
              app: apisix-gateway
      ports:
        - protocol: TCP
          port: 8081
```

### 5.9 API Key 管理规范

| 项目 | 规范 |
|------|------|
| **Key 格式** | `{服务缩写}_` + 32位随机字符串，如 `uk_a1b2c3d4e5f6...` |
| **存储方式** | **K8s Secret**，禁止硬编码 |
| **轮换周期** | 建议 90 天轮换一次 |
| **失效处理** | Key 泄露时立即吊销，服务使用新 Key |
| **审计日志** | 记录所有内部 API 调用（调用方、时间、接口） |

#### API Key 生成脚本

```bash
#!/bin/bash
# generate-api-keys.sh

services=("koduck-user" "koduck-market" "koduck-portfolio" "koduck-community")

for service in "${services[@]}"; do
    prefix=$(echo "$service" | cut -d'-' -f2 | cut -c1-2)
    key="${prefix}_$(openssl rand -hex 32)"
    echo "${service}: ${key}"
    
    # 创建 K8s Secret（唯一存储方式）
    kubectl create secret generic "${service}-internal-key" \
        --from-literal="api-key=${key}" \
        --namespace=koduck \
        --dry-run=client -o yaml | kubectl apply -f -
done
```

### 5.10 调用时序图

```
koduck-user                koduck-auth
    │                          │
    │  1. 需要查询用户信息        │
    │                          │
    │  2. 构造请求                │
    │     X-Internal-Key: uk_xxx │
    │     X-Caller-Service: koduck-user
    │ ────────────────────────▶│
    │                          │
    │                          │ 3. 验证 Key
    │                          │    验证 Caller
    │                          │    验证 IP 白名单
    │                          │
    │  4. 返回用户信息            │
    │ ◀────────────────────────│
    │                          │
```

### 5.11 安全注意事项

1. **网络隔离**：服务间调用仅允许在 K8s 集群内部，不暴露到公网
2. **最小权限**：每个服务只能访问其需要的 API
3. **K8s Secret 管理**：API Key 必须存储在 K8s Secret 中，通过环境变量注入容器，禁止任何形式的硬编码
4. **监控告警**：对异常调用频率进行监控和告警
5. **定期轮换**：建立 Key 轮换机制，降低泄露风险
```

**使用场景**：
- 高安全要求环境
- 需要实时撤销 Token 检查

---

## 6. 完整部署架构

### 6.1 K8s 部署拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                         K8s Cluster                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      APISIX (Gateway)                    │   │
│  │                    NodePort / LoadBalancer               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────┐     │
│  │                           │                           │     │
│  ▼                           ▼                           ▼     │
│ ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│ │koduck-auth  │      │koduck-user  │      │koduck-market│     │
│ │  2 replicas │      │  2 replicas │      │  2 replicas │     │
│ │  Port: 8081 │      │  Port: 8082 │      │  Port: 8083 │     │
│ └─────────────┘      └─────────────┘      └─────────────┘     │
│       │                     │                     │            │
│       ▼                     ▼                     ▼            │
│ ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│ │  auth-db    │      │  user-db    │      │  market-db  │     │
│ │ (PostgreSQL)│      │ (PostgreSQL)│      │ (PostgreSQL)│     │
│ └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Shared Services                             │   │
│  │  • Redis (Session/Cache)                                 │   │
│  │  • RabbitMQ (Event Bus)                                  │   │
│  │  • K8s Secret (API Key 管理)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 配置文件结构

```
k8s/
├── base/
│   ├── apisix.yaml                    # APISIX 网关部署
│   ├── koduck-auth/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── koduck-user/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   └── ...
├── overlays/
│   ├── dev/
│   │   ├── apisix-route-init.yaml     # 路由初始化（含服务发现）
│   │   └── kustomization.yaml
│   └── prod/
│       └── ...
```

---

## 7. 配置清单（微服务版）

### 7.1 koduck-auth 配置

```yaml
# koduck-auth/application.yml
server:
  port: 8081

spring:
  application:
    name: koduck-auth
  datasource:
    url: jdbc:postgresql://auth-db:5432/koduck_auth
    
jwt:
  algorithm: RS256
  private-key-location: vault://secret/koduck/jwt-private-key
  key-id: koduck-key-2024-001
  access-token-expiration: 900000      # 15分钟
  refresh-token-expiration: 604800000  # 7天
  
  # JWKS 端点配置
  jwks:
    enabled: true
    path: /.well-known/jwks.json
    cache-ttl: 86400  # 24小时

# 内部服务调用认证
internal:
  auth:
    enabled: true
    token-header: X-Internal-Token
```

### 7.2 APISIX 配置（含服务发现）

```yaml
# apisix-route-init.yaml（完整微服务版）

# 1. JWT Consumer（RS256 公钥验签）
echo "Registering JWT consumer: koduck_user (RS256)"
curl -fsS -X PUT "${ADMIN}/consumers/koduck_user" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d "$(printf '{
    "username": "koduck_user",
    "plugins": {
      "jwt-auth": {
        "key": "koduck_user",
        "algorithm": "RS256",
        "public_key": "%s",
        "exp": 900
      }
    }
  }' "$JWT_PUBLIC_KEY")"

# 2. koduck-auth 服务路由（公开）
echo "Registering koduck-auth routes (public)"
curl -fsS -X PUT "${ADMIN}/routes/auth-public" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/auth/*",
    "priority": 100,
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    }
  }'

# 3. JWKS 端点（公开，供其他服务获取公钥）
echo "Registering JWKS endpoint (public)"
curl -fsS -X PUT "${ADMIN}/routes/jwks" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/.well-known/jwks.json",
    "priority": 100,
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    }
  }'

# 4. koduck-user 服务路由（需认证）
echo "Registering koduck-user routes (protected)"
curl -fsS -X PUT "${ADMIN}/routes/user-service" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/users/*",
    "priority": 90,
    "plugins": {
      "jwt-auth": {},
      "proxy-rewrite": {
        "headers": {
          "X-User-Id": "$jwt_claim_user_id",
          "X-Username": "$jwt_claim_username",
          "X-Roles": "$jwt_claim_roles"
        }
      }
    },
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-user:8082": 1
      }
    }
  }'

# 5. 业务服务路由（需认证，统一前缀）
echo "Registering business services routes"
for service in market portfolio strategy community; do
  port=$((8080 + $(echo $service | cksum | cut -d' ' -f1) % 100))
  curl -fsS -X PUT "${ADMIN}/routes/${service}-service" \
    -H "$KEY" -H 'Content-Type: application/json' \
    -d "$(printf '{
      \"uri\": \"/api/v1/%s/*\",
      \"priority\": 80,
      \"plugins\": {
        \"jwt-auth\": {},
        \"proxy-rewrite\": {
          \"headers\": {
            \"X-User-Id\": \"$jwt_claim_user_id\",
            \"X-Username\": \"$jwt_claim_username\",
            \"X-Roles\": \"$jwt_claim_roles\"
          }
        }
      },
      \"upstream\": {
        \"type\": \"roundrobin\",
        \"nodes\": {
          \"koduck-%s:%s\": 1
        }
      }
    }' "$service" "$service" "$port")"
done
```

---

## 8. 演进路线（更新）

| 阶段 | 目标 | 架构 | 关键任务 |
|------|------|------|----------|
| **Phase 0** | 当前 | 单体 | HS256，所有模块在一个 JAR | ✅ |
| **Phase 1** | RS256 改造 | 单体 | 迁移到公钥验签 | 🔄 |
| **Phase 2** | **服务拆分** | **微服务** | **koduck-auth/user 独立部署，APISIX 服务发现** | ⏳ |
| **Phase 3** | 服务网格 | 微服务 + Istio | mTLS，流量治理，可观测性 | ⏳ |
| **Phase 4** | OIDC | 微服务 | 实现 OIDC Provider | ⏳ |
| **Phase 5** | 零信任 | 云原生 | SPIFFE/SPIRE，细粒度授权 | ⏳ |

### Phase 2: 服务拆分任务清单

| 序号 | 任务 | 涉及文件 | 说明 |
|------|------|----------|------|
| 1 | 创建独立 Dockerfile | `koduck-auth/Dockerfile` | 独立构建镜像 |
| 2 | 创建 K8s Deployment | `k8s/base/koduck-auth/` | 独立部署配置 |
| 3 | 创建 K8s Service | `k8s/base/koduck-auth/service.yaml` | ClusterIP 类型 |
| 4 | 更新 APISIX 路由 | `k8s/overlays/dev/apisix-route-init.yaml` | 使用 K8s DNS 服务发现 |
| 5 | 配置服务间通信 | `koduck-user/config` | 内部调用 koduck-auth |
| 6 | 数据库拆分 | K8s PVC/StatefulSet | auth_db, user_db 分离 |
| 7 | 配置中心 | Spring Cloud Config / Nacos | 集中管理配置 |
| 8 | 服务网格（可选） | Istio | mTLS，流量管理 |

---

## 9. 相关文档

- `koduck-backend/koduck-auth/src/main/java/com/koduck/util/JwtUtil.java`
- `koduck-backend/koduck-infrastructure/src/main/java/com/koduck/infrastructure/config/JwtConfig.java`
- `k8s/overlays/dev/apisix-route-init.yaml`
- `k8s/base/apisix.yaml`
- APISIX 服务发现文档：https://apisix.apache.org/docs/apisix/discovery/
- APISIX jwt-auth 插件：https://apisix.apache.org/docs/apisix/plugins/jwt-auth/

---

*文档版本: 4.0*  
*更新日期: 2026-04-07*  
*作者: Koduck Team*
