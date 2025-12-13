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

interface CreatePayoutParams {
    outTradeNo: string;      // 商户订单号
    amount: string;          // 代付金额（保留两位小数）
    notifyUrl: string;       // 回调地址
    upi: string;             // UPI地址
    mobileNo: string;        // 手机号
}

interface PayoutResponse {
    uuid: string;
    code: string;
    msg: string;
    data: {
        orderNo: string;     // 平台单号
        status: string;      // 0=提交成功，其他=失败
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

        // 启动时记录配置状态（隐藏敏感信息）
        logger.info('FendPay服务初始化', {
            merchantNumber: this.config.merchantNumber ? this.config.merchantNumber.substring(0, 4) + '***' : 'NOT_SET',
            secretConfigured: !!this.config.secret,
            secretLength: this.config.secret ? this.config.secret.length : 0,
            apiUrl: this.config.apiUrl,
            envVars: {
                FENDPAY_MERCHANT_NUMBER: !!process.env.FENDPAY_MERCHANT_NUMBER,
                FENDPAY_SECRET: !!process.env.FENDPAY_SECRET,
                FENDPAY_API_BASE_URL: !!process.env.FENDPAY_API_BASE_URL
            }
        });

        if (!this.config.merchantNumber || !this.config.secret) {
            logger.error('FendPay配置不完整！请检查环境变量', {
                hasMerchantNumber: !!this.config.merchantNumber,
                hasSecret: !!this.config.secret
            });
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
                // 金额类参数必须格式化为两位小数字符串（如 "1000.00"）
                if (key === 'amount') {
                    const numValue = typeof params[key] === 'string' ? parseFloat(params[key]) : params[key];
                    filteredParams[key] = numValue.toFixed(2);
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
                url: `${this.config.apiUrl}/pay/payment`,
                requestBody: {
                    ...requestBody,
                    merchantNumber: this.config.merchantNumber.substring(0, 4) + '***',
                    sign: sign.substring(0, 10) + '...'
                },
                fullRequest: requestData
            });

            // 发送请求
            const response = await fetch(`${this.config.apiUrl}/pay/payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            const httpStatus = response.status;
            const result = await response.json() as OrderResponse;

            logger.info('FendPay创建订单响应', {
                httpStatus,
                code: result.code,
                msg: result.msg,
                uuid: result.uuid,
                hasData: !!result.data,
                fullResponse: result
            });

            if (result.code === '200' && result.data) {
                logger.info('FendPay订单创建成功', {
                    orderNo: result.data.orderNo,
                    payUrl: result.data.payUrl,
                });
            } else {
                logger.error('FendPay订单创建失败', {
                    code: result.code,
                    msg: result.msg,
                    uuid: result.uuid,
                    data: result.data,
                    fullResponse: result
                });
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
     * 创建UPI代付订单
     */
    async createPayout(params: CreatePayoutParams): Promise<PayoutResponse> {
        try {
            // 确保金额格式正确（两位小数）
            const amount = parseFloat(params.amount).toFixed(2);

            const requestBody = {
                merchantNumber: this.config.merchantNumber,
                outTradeNo: params.outTradeNo,
                amount: amount,
                notifyUrl: params.notifyUrl,
                upi: params.upi,
                mobileNo: params.mobileNo,
            };

            // 生成签名
            const sign = this.generateSign(requestBody);
            const requestData = { ...requestBody, sign };

            logger.info('FendPay创建代付订单请求', {
                url: `${this.config.apiUrl}/pay/upi/payout`,
                requestBody: {
                    ...requestBody,
                    merchantNumber: this.config.merchantNumber.substring(0, 4) + '***',
                    sign: sign.substring(0, 10) + '...'
                }
            });

            // 发送请求
            const response = await fetch(`${this.config.apiUrl}/pay/upi/payout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            const httpStatus = response.status;
            const result = await response.json() as PayoutResponse;

            logger.info('FendPay创建代付订单响应', {
                httpStatus,
                code: result.code,
                msg: result.msg,
                uuid: result.uuid,
                hasData: !!result.data,
                status: result.data?.status
            });

            if (result.code === '200' && result.data) {
                logger.info('FendPay代付订单创建成功', {
                    orderNo: result.data.orderNo,
                    status: result.data.status,
                });
            } else {
                logger.error('FendPay代付订单创建失败', {
                    code: result.code,
                    msg: result.msg,
                    uuid: result.uuid,
                });
            }

            return result;

        } catch (error: any) {
            logger.error('FendPay创建代付订单异常', {
                error: error.message,
                stack: error.stack,
            });
            throw new Error('创建代付订单失败: ' + error.message);
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
