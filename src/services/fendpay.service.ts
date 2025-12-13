/**
 * FendPay 支付服务
 * 文档：https://kspay.shop
 */
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface FendPayConfig {
    merchantNumber: string;
    secret: string;
    apiUrl: string;
}

interface CreateOrderParams {
    outTradeNo: string;      // 商户订单号
    amount: string;          // 金额（保留两位小数）
    notifyUrl: string;       // 回调地址
    callbackUrl: string;     // 支付成功后跳转地址
}

interface OrderResponse {
    uuid: string;
    code: string;
    msg: string;
    data: {
        orderNo: string;     // 平台订单号
        payUrl: string;      // 支付链接
    } | null;
}

interface QueryOrderParams {
    outTradeNo: string;      // 商户订单号
}

interface QueryOrderResponse {
    uuid: string;
    code: string;
    msg: string;
    data: {
        orderNo: string;
        status: number;      // 1=成功，其他=失败
        amount: string;
        utr?: string;        // 流水号
        outTradeNo: string;
        sign: string;
    } | null;
}

export class FendPayService {
    private config: FendPayConfig;

    constructor() {
        this.config = {
            merchantNumber: process.env.FENDPAY_MERCHANT_NUMBER || '',
            secret: process.env.FENDPAY_SECRET || '',
            apiUrl: process.env.FENDPAY_API_BASE_URL || 'https://kspay.shop',
        };

        if (!this.config.merchantNumber || !this.config.secret) {
            logger.warn('FendPay配置不完整，请检查环境变量');
        }
    }

    /**
     * 生成签名
     * 1. 将参数按key排序
     * 2. 拼接成 key=value&key=value 格式
     * 3. 末尾添加 &key=secret
     * 4. MD5加密并转小写
     */
    private generateSign(params: Record<string, any>): string {
        // 过滤掉 sign 字段和空值
        const filteredParams: Record<string, string> = {};
        Object.keys(params).forEach(key => {
            if (key !== 'sign' && params[key] !== null && params[key] !== undefined && params[key] !== '') {
                // 金额类参数格式化为两位小数
                if (key === 'amount' && typeof params[key] === 'number') {
                    filteredParams[key] = params[key].toFixed(2);
                } else {
                    filteredParams[key] = String(params[key]);
                }
            }
        });

        // 按key的ASCII码从小到大排序
        const sortedKeys = Object.keys(filteredParams).sort();
        
        // 拼接成 key=value&key=value 格式
        const signStr = sortedKeys
            .map(key => `${key}=${filteredParams[key]}`)
            .join('&') + `&key=${this.config.secret}`;

        logger.info('FendPay签名字符串', { signStr: signStr.replace(this.config.secret, '***') });

        // MD5加密并转小写
        const sign = crypto.createHash('md5').update(signStr).digest('hex').toLowerCase();
        
        return sign;
    }

    /**
     * 验证回调签名
     */
    public verifySign(params: Record<string, any>): boolean {
        const receivedSign = params.sign;
        if (!receivedSign) {
            logger.error('回调缺少签名字段');
            return false;
        }

        const calculatedSign = this.generateSign(params);
        const isValid = calculatedSign === receivedSign;

        if (!isValid) {
            logger.error('签名验证失败', {
                received: receivedSign,
                calculated: calculatedSign,
            });
        }

        return isValid;
    }

    /**
     * 创建代收订单
     */
    async createOrder(params: CreateOrderParams): Promise<OrderResponse> {
        try {
            // 确保金额格式正确（两位小数）
            const amount = parseFloat(params.amount).toFixed(2);

            const requestBody = {
                merchantNumber: this.config.merchantNumber,
                outTradeNo: params.outTradeNo,
                amount: amount,
                notifyUrl: params.notifyUrl,
                callbackUrl: params.callbackUrl,
            };

            // 生成签名
            const sign = this.generateSign(requestBody);
            const requestData = { ...requestBody, sign };

            logger.info('FendPay创建订单请求', {
                outTradeNo: params.outTradeNo,
                amount: amount,
            });

            // 发送请求
            const response = await fetch(`${this.config.apiUrl}/pay/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            const result = await response.json() as OrderResponse;

            logger.info('FendPay创建订单响应', {
                code: result.code,
                msg: result.msg,
                hasData: !!result.data,
            });

            if (result.code === '200' && result.data) {
                logger.info('FendPay订单创建成功', {
                    orderNo: result.data.orderNo,
                    payUrl: result.data.payUrl,
                });
            } else {
                logger.error('FendPay订单创建失败', result);
            }

            return result;

        } catch (error: any) {
            logger.error('FendPay创建订单异常', {
                error: error.message,
                stack: error.stack,
            });
            throw new Error('创建支付订单失败: ' + error.message);
        }
    }

    /**
     * 查询订单状态
     */
    async queryOrder(params: QueryOrderParams): Promise<QueryOrderResponse> {
        try {
            const requestBody = {
                merchantNumber: this.config.merchantNumber,
                outTradeNo: params.outTradeNo,
            };

            // 生成签名
            const sign = this.generateSign(requestBody);
            const requestData = { ...requestBody, sign };

            logger.info('FendPay查询订单', { outTradeNo: params.outTradeNo });

            const response = await fetch(`${this.config.apiUrl}/pay/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            const result = await response.json() as QueryOrderResponse;

            logger.info('FendPay查询订单响应', {
                code: result.code,
                status: result.data?.status,
            });

            // 验证返回的签名（如果有data）
            if (result.code === '200' && result.data) {
                const isValid = this.verifySign(result.data);
                if (!isValid) {
                    logger.error('FendPay查询订单响应签名验证失败', {
                        outTradeNo: params.outTradeNo,
                    });
                    throw new Error('查询订单响应签名验证失败');
                }
            }

            return result;

        } catch (error: any) {
            logger.error('FendPay查询订单异常', {
                error: error.message,
                stack: error.stack,
            });
            throw new Error('查询订单失败: ' + error.message);
        }
    }

    /**
     * 格式化金额（保留两位小数）
     */
    public formatAmount(amount: number): string {
        return amount.toFixed(2);
    }
}

// 导出单例
export const fendPayService = new FendPayService();
