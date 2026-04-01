# Koduck Quant API 文档规范

## 概述

本文档定义了 Koduck Quant 项目的 API 文档标准，旨在确保 Swagger/OpenAPI 文档的一致性、完整性和可用性。

## 技术栈

- **OpenAPI 版本**: 3.0.1
- **SpringDoc OpenAPI**: 用于生成 OpenAPI 规范
- **Swagger UI**: `/swagger-ui.html`
- **API Docs JSON**: `/v3/api-docs`

## 注解使用规范

### 1. 类级别注解

#### @Tag
用于对 API 进行分类，每个 Controller 必须添加。

```java
@Tag(
    name = "认证管理", 
    description = "用户登录、注册、Token刷新等认证相关接口"
)
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController { }
```

**命名规范**:
- 使用中文名称，简洁明了
- 避免过于宽泛的分类
- 保持与业务模块对应

### 2. 方法级别注解

#### @Operation
描述 API 接口的功能。

```java
@Operation(
    summary = "用户登录", 
    description = "使用用户名和密码登录，返回 JWT Token\n\n" +
                  "注意：连续登录失败超过5次将触发账号锁定"
)
```

**字段说明**:
| 字段 | 必填 | 说明 |
|------|------|------|
| summary | 是 | 接口简短描述（50字以内） |
| description | 否 | 详细描述，可包含多行、注意事项 |

#### @ApiResponses
定义所有可能的响应情况。

```java
@ApiResponses(value = {
    @ApiResponse(
        responseCode = "200",
        description = "操作成功",
        content = @Content(
            mediaType = "application/json",
            schema = @Schema(implementation = TokenResponse.class),
            examples = @ExampleObject(
                name = "success",
                summary = "成功示例",
                value = """
                    {
                      "code": 0,
                      "message": "success",
                      "data": {
                        "accessToken": "eyJhbGciOiJIUzI1NiIs...",
                        "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
                        "expiresIn": 3600
                      },
                      "timestamp": 1704067200000
                    }
                    """
            )
        )
    ),
    @ApiResponse(responseCode = "400", description = "请求参数错误"),
    @ApiResponse(responseCode = "401", description = "认证失败"),
    @ApiResponse(responseCode = "403", description = "权限不足"),
    @ApiResponse(responseCode = "404", description = "资源不存在"),
    @ApiResponse(responseCode = "500", description = "服务器内部错误")
})
```

**响应码规范**:
| 状态码 | 使用场景 | 说明 |
|--------|----------|------|
| 200 | 成功 | 正常业务处理成功 |
| 400 | 请求错误 | 参数校验失败、格式错误 |
| 401 | 未认证 | Token 缺失、过期或无效 |
| 403 | 禁止访问 | 权限不足、角色不匹配 |
| 404 | 未找到 | 资源不存在、路径错误 |
| 409 | 冲突 | 资源已存在、状态冲突 |
| 422 | 不可处理 | 语义错误、业务规则违反 |
| 429 | 限流 | 请求过于频繁 |
| 500 | 服务器错误 | 内部异常、服务不可用 |
| 503 | 服务不可用 | 维护中、依赖服务故障 |

#### @Parameter
描述请求参数。

```java
@GetMapping("/stocks/{symbol}")
public ApiResponse<PriceQuoteDto> getStockDetail(
    @Parameter(
        description = "股票代码",
        example = "600519",
        required = true,
        schema = @Schema(pattern = "^[0-9]{6}$")
    )
    @PathVariable 
    @NotBlank(message = "股票代码不能为空") 
    String symbol
) { }
```

**参数位置**:
- `@PathVariable`: 路径参数
- `@RequestParam`: 查询参数
- `@RequestHeader`: 请求头参数
- `@RequestBody`: 请求体（不需要 @Parameter）

### 3. DTO 级别注解

#### @Schema
描述数据模型和字段。

```java
@Schema(
    description = "用户登录请求",
    example = """
        {
          "username": "john_doe",
          "password": "********",
          "captchaToken": "captcha_xxx"
        }
        """
)
public class LoginRequest {
    
    @Schema(
        description = "用户名",
        example = "john_doe",
        requiredMode = Schema.RequiredMode.REQUIRED,
        minLength = 3,
        maxLength = 50
    )
    @NotBlank
    private String username;
    
    @Schema(
        description = "密码",
        example = "********",
        requiredMode = Schema.RequiredMode.REQUIRED,
        minLength = 8,
        maxLength = 100
    )
    @NotBlank
    private String password;
}
```

## 示例值规范

### 股票代码示例
| 市场 | 示例代码 | 说明 |
|------|----------|------|
| A股 | 600519 | 贵州茅台（沪市） |
| A股 | 000001 | 平安银行（深市） |
| A股 | 300750 | 宁德时代（创业板） |
| A股 | 688981 | 中芯国际（科创板） |
| 港股 | 00700 | 腾讯控股 |
| 美股 | AAPL | 苹果公司 |

### 时间格式示例
| 类型 | 格式 | 示例 |
|------|------|------|
| Date | yyyy-MM-dd | 2024-01-15 |
| DateTime | ISO 8601 | 2024-01-15T09:30:00+08:00 |
| Timestamp | Unix 毫秒 | 1705315200000 |

## 完整示例

### Controller 示例

```java
@Tag(name = "行情数据", description = "股票行情查询接口")
@RestController
@RequestMapping("/api/v1/market")
@Validated
@RequiredArgsConstructor
public class MarketController {

    private final MarketService marketService;

    @Operation(
        summary = "搜索股票",
        description = "根据关键词搜索股票代码和名称，支持拼音首字母搜索"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "搜索成功",
            content = @Content(
                schema = @Schema(implementation = SymbolInfoDto.class)
            )
        ),
        @ApiResponse(responseCode = "400", description = "关键词为空或过长"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/search")
    public ApiResponse<List<SymbolInfoDto>> searchSymbols(
        @Parameter(description = "搜索关键词", example = "茅台") 
        @RequestParam 
        @NotBlank 
        String keyword,
        
        @Parameter(description = "页码", example = "1") 
        @RequestParam(defaultValue = "1") 
        @Min(1) 
        int page,
        
        @Parameter(description = "每页数量", example = "20") 
        @RequestParam(defaultValue = "20") 
        @Min(1) @Max(100) 
        int size
    ) {
        return ApiResponse.success(marketService.searchSymbols(keyword, page, size));
    }
}
```

### DTO 示例

```java
@Schema(description = "股票基本信息")
@Data
@Builder
public class SymbolInfoDto {
    
    @Schema(description = "股票代码", example = "600519")
    private String symbol;
    
    @Schema(description = "股票名称", example = "贵州茅台")
    private String name;
    
    @Schema(description = "交易所", example = "SH", allowableValues = {"SH", "SZ", "BJ"})
    private String exchange;
    
    @Schema(description = "市场类型", example = "A_SHARE")
    private String marketType;
}
```

## 检查清单

### Controller 检查项
- [ ] 类上有 @Tag 注解
- [ ] 每个 public 方法有 @Operation 注解
- [ ] 每个方法有完整的 @ApiResponses
- [ ] 所有参数有 @Parameter 注解（@RequestBody 除外）
- [ ] 示例值真实可用

### DTO 检查项
- [ ] 类上有 @Schema 描述
- [ ] 每个字段有 @Schema 描述
- [ ] 关键字段有 example
- [ ] 必填字段标记 requiredMode
- [ ] 枚举字段标记 allowableValues

## 常见错误码说明

| 错误码 | 错误信息 | 说明 |
|--------|----------|------|
| 0 | success | 操作成功 |
| 400001 | 参数校验失败 | 请求参数不符合要求 |
| 401001 | Token 无效 | JWT Token 已过期或格式错误 |
| 401002 | 登录失败 | 用户名或密码错误 |
| 403001 | 权限不足 | 当前用户无权访问 |
| 404001 | 股票不存在 | 指定的股票代码未找到 |
| 404002 | 用户不存在 | 指定的用户 ID 未找到 |
| 409001 | 资源已存在 | 重复创建相同资源 |
| 429001 | 请求过于频繁 | 触发限流保护 |
| 500001 | 服务器内部错误 | 未知异常 |
| 503001 | 服务暂时不可用 | 维护中或依赖服务故障 |

## 参考资源

- [SpringDoc OpenAPI 文档](https://springdoc.org/)
- [OpenAPI 3.0 规范](https://swagger.io/specification/)
- [Swagger UI 文档](https://swagger.io/tools/swagger-ui/)
