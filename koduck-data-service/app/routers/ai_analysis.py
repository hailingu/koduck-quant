"""AI Analysis Router - 股票智能分析 API

提供基于 LLM 的股票分析功能，封装 koduck-agent 的 API 调用。
"""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Analysis"])

# Koduck Agent 服务地址
AGENT_BASE_URL = "http://agent:8000"


class StockAnalysisRequest(BaseModel):
    """股票分析请求"""
    symbol: str = Field(..., description="股票代码")
    name: str = Field(..., description="股票名称")
    price: float = Field(..., description="当前价格")
    change_percent: float = Field(..., description="涨跌幅")
    open_price: float = Field(..., description="开盘价")
    high: float = Field(..., description="最高价")
    low: float = Field(..., description="最低价")
    prev_close: float = Field(..., description="昨收价")
    volume: int = Field(..., description="成交量")
    amount: Optional[float] = Field(None, description="成交额")
    question: str = Field(default="趋势分析", description="分析问题类型")
    provider: str = Field(default="kimi", description="LLM 提供商: kimi/zlm/minimax")


class StockAnalysisResponse(BaseModel):
    """股票分析响应"""
    analysis: str = Field(..., description="AI 分析结果")
    provider: str = Field(..., description="使用的 LLM 提供商")
    model: Optional[str] = Field(None, description="使用的模型")


def build_analysis_prompt(request: StockAnalysisRequest) -> str:
    """构建分析提示词"""
    amount_str = f"{request.amount:.2f}" if request.amount else "未知"
    
    prompt = f"""你是一位专业的股票分析师。请基于以下股票数据进行专业分析：

【股票信息】
- 股票名称: {request.name} ({request.symbol})
- 当前价格: {request.price:.2f} 元
- 涨跌幅: {request.change_percent:+.2f}%
- 开盘价: {request.open_price:.2f} 元
- 最高价: {request.high:.2f} 元
- 最低价: {request.low:.2f} 元
- 昨收价: {request.prev_close:.2f} 元
- 成交量: {request.volume:,} 股
- 成交额: {amount_str} 元

【用户问题】
{request.question}

请提供：
1. 技术面简要分析
2. 关键价位判断（支撑/阻力）
3. 短期趋势判断
4. 风险提示

要求：
- 使用中文回答
- 简洁专业，避免过度预测
- 必须包含风险提示"""

    return prompt


@router.post("/analyze", response_model=StockAnalysisResponse)
async def analyze_stock(request: StockAnalysisRequest):
    """股票智能分析
    
    基于 LLM 对股票数据进行专业分析。
    """
    try:
        # 构建提示词
        prompt = build_analysis_prompt(request)
        
        # 调用 koduck-agent 服务
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{AGENT_BASE_URL}/v1/chat/completions",
                json={
                    "provider": request.provider,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Agent API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail=f"AI 服务调用失败: {response.status_code}"
                )
            
            result = response.json()
            
            # 提取分析结果
            analysis = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            model = result.get("model", "unknown")
            provider = result.get("provider", request.provider)
            
            return StockAnalysisResponse(
                analysis=analysis,
                provider=provider,
                model=model
            )
            
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to agent service: {e}")
        raise HTTPException(
            status_code=503,
            detail="AI 服务暂时不可用，请稍后重试"
        )
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"分析失败: {str(e)}"
        )


@router.get("/models")
async def list_models():
    """获取可用的 AI 模型列表"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{AGENT_BASE_URL}/v1/models")
            
            if response.status_code != 200:
                return {
                    "models": [
                        {"id": "moonshot-v1-8k", "provider": "kimi", "name": "Kimi 8K"},
                        {"id": "moonshot-v1-32k", "provider": "kimi", "name": "Kimi 32K"},
                    ]
                }
            
            return response.json()
            
    except Exception as e:
        logger.warning(f"Failed to fetch models from agent: {e}")
        # 返回默认模型列表
        return {
            "models": [
                {"id": "moonshot-v1-8k", "provider": "kimi", "name": "Kimi 8K"},
                {"id": "moonshot-v1-32k", "provider": "kimi", "name": "Kimi 32K"},
                {"id": "glm-4-flash", "provider": "zlm", "name": "GLM-4 Flash"},
            ]
        }


@router.get("/health")
async def health_check():
    """AI 服务健康检查"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{AGENT_BASE_URL}/health")
            
            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "agent": response.json()
                }
            else:
                return {
                    "status": "degraded",
                    "agent": {"status": "unavailable"}
                }
                
    except Exception as e:
        logger.warning(f"Agent health check failed: {e}")
        return {
            "status": "unavailable",
            "error": str(e)
        }
