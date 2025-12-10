import TronWeb from 'tronweb';
import { config } from '../config';
import { logger } from '../utils/logger';
import axios from 'axios';

interface TronTransaction {
    txID: string;
    visible: boolean;
    raw_data: {
        contract: Array<{
            parameter: {
                value: {
                    amount?: number;
                    owner_address?: string;
                    to_address?: string;
                    data?: string;
                };
                type_url: string;
            };
            type: string;
        }>;
        ref_block_bytes: string;
        ref_block_hash: string;
        expiration: number;
        timestamp: number;
    };
    ret?: Array<{
        contractRet: string;
    }>;
}

interface TRC20TransferInfo {
    from: string;
    to: string;
    value: string;
    tokenAddress: string;
}

export class TronService {
    private tronWeb: TronWeb;
    private apiHeaders: Record<string, string>;

    constructor() {
        this.tronWeb = new TronWeb({
            fullHost: config.tron.apiUrl,
            headers: config.tron.apiKey ? { 'TRON-PRO-API-KEY': config.tron.apiKey } : {},
        });

        this.apiHeaders = config.tron.apiKey 
            ? { 'TRON-PRO-API-KEY': config.tron.apiKey }
            : {};
    }

    /**
     * 验证 TRC20 支付交易
     */
    async verifyPaymentTransaction(
        txHash: string,
        expectedAmount: number,
        expectedToAddress: string
    ): Promise<{
        valid: boolean;
        confirmations: number;
        actualAmount?: number;
        fromAddress?: string;
        error?: string;
    }> {
        try {
            logger.info('Verifying payment transaction', { txHash, expectedAmount, expectedToAddress });

            // 获取交易信息
            const txInfo = await this.getTransactionInfo(txHash);
            
            if (!txInfo) {
                return { valid: false, confirmations: 0, error: 'Transaction not found' };
            }

            // 检查交易是否成功
            if (!txInfo.ret || txInfo.ret[0]?.contractRet !== 'SUCCESS') {
                return { valid: false, confirmations: 0, error: 'Transaction failed on chain' };
            }

            // 解析 TRC20 转账信息
            const transferInfo = await this.parseTRC20Transfer(txHash);
            
            if (!transferInfo) {
                return { valid: false, confirmations: 0, error: 'Not a valid TRC20 transfer' };
            }

            // 验证代币合约地址
            if (transferInfo.tokenAddress.toLowerCase() !== config.tron.usdtContractAddress.toLowerCase()) {
                return { 
                    valid: false, 
                    confirmations: 0, 
                    error: `Wrong token contract. Expected ${config.tron.usdtContractAddress}, got ${transferInfo.tokenAddress}` 
                };
            }

            // 验证接收地址
            const toAddressBase58 = this.tronWeb.address.fromHex(transferInfo.to);
            if (toAddressBase58 !== expectedToAddress) {
                return { 
                    valid: false, 
                    confirmations: 0, 
                    error: `Wrong recipient address. Expected ${expectedToAddress}, got ${toAddressBase58}` 
                };
            }

            // 验证金额 (USDT has 6 decimals)
            const actualAmount = parseFloat(transferInfo.value) / 1e6;
            const tolerance = 0.01; // 允许 0.01 USDT 误差
            
            if (Math.abs(actualAmount - expectedAmount) > tolerance) {
                return { 
                    valid: false, 
                    confirmations: 0, 
                    actualAmount,
                    error: `Wrong amount. Expected ${expectedAmount}, got ${actualAmount}` 
                };
            }

            // 获取确认数
            const confirmations = await this.getConfirmations(txHash);

            const fromAddressBase58 = this.tronWeb.address.fromHex(transferInfo.from);

            logger.info('Payment transaction verified', {
                txHash,
                actualAmount,
                fromAddress: fromAddressBase58,
                confirmations,
                valid: confirmations >= config.payment.confirmations,
            });

            return {
                valid: confirmations >= config.payment.confirmations,
                confirmations,
                actualAmount,
                fromAddress: fromAddressBase58,
            };

        } catch (error: any) {
            logger.error('Error verifying payment transaction', { txHash, error: error.message });
            return { 
                valid: false, 
                confirmations: 0, 
                error: `Verification failed: ${error.message}` 
            };
        }
    }

    /**
     * 获取交易信息
     */
    private async getTransactionInfo(txHash: string): Promise<TronTransaction | null> {
        try {
            const response = await axios.post(
                `${config.tron.apiUrl}/wallet/gettransactionbyid`,
                { value: txHash },
                { headers: this.apiHeaders }
            );

            return response.data || null;
        } catch (error: any) {
            logger.error('Error getting transaction info', { txHash, error: error.message });
            return null;
        }
    }

    /**
     * 解析 TRC20 转账事件
     */
    private async parseTRC20Transfer(txHash: string): Promise<TRC20TransferInfo | null> {
        try {
            const response = await axios.get(
                `${config.tron.apiUrl}/v1/transactions/${txHash}/events`,
                { headers: this.apiHeaders }
            );

            const events = response.data.data || [];
            
            // 查找 Transfer 事件
            const transferEvent = events.find(
                (event: any) => event.event_name === 'Transfer' && event.contract_address
            );

            if (!transferEvent) {
                return null;
            }

            return {
                from: transferEvent.result.from || transferEvent.result[0],
                to: transferEvent.result.to || transferEvent.result[1],
                value: transferEvent.result.value || transferEvent.result[2],
                tokenAddress: this.tronWeb.address.fromHex(transferEvent.contract_address),
            };
        } catch (error: any) {
            logger.error('Error parsing TRC20 transfer', { txHash, error: error.message });
            return null;
        }
    }

    /**
     * 获取交易确认数
     */
    private async getConfirmations(txHash: string): Promise<number> {
        try {
            const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
            
            if (!txInfo || !txInfo.blockNumber) {
                return 0;
            }

            const currentBlock = await this.tronWeb.trx.getCurrentBlock();
            const currentBlockNumber = currentBlock.block_header.raw_data.number;

            return Math.max(0, currentBlockNumber - txInfo.blockNumber);
        } catch (error: any) {
            logger.error('Error getting confirmations', { txHash, error: error.message });
            return 0;
        }
    }

    /**
     * 发送 TRC20 代币
     */
    async sendTRC20(
        toAddress: string,
        amount: number,
        privateKey?: string
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const key = privateKey || config.platform.privateKey;
            
            if (!key) {
                throw new Error('Private key not configured');
            }

            // 设置私钥
            this.tronWeb.setPrivateKey(key);

            // 获取合约实例
            const contract = await this.tronWeb.contract().at(config.tron.usdtContractAddress);

            // USDT 有 6 位小数
            const amountInSun = Math.floor(amount * 1e6);

            logger.info('Sending TRC20', { toAddress, amount, amountInSun });

            // 调用 transfer 方法
            const transaction = await contract.transfer(toAddress, amountInSun).send({
                feeLimit: 100_000_000, // 100 TRX
            });

            logger.info('TRC20 sent successfully', { txHash: transaction, toAddress, amount });

            return { success: true, txHash: transaction };
        } catch (error: any) {
            logger.error('Error sending TRC20', { toAddress, amount, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取地址 TRC20 余额
     */
    async getTRC20Balance(address: string): Promise<number> {
        try {
            const contract = await this.tronWeb.contract().at(config.tron.usdtContractAddress);
            const balance = await contract.balanceOf(address).call();
            return parseFloat(balance.toString()) / 1e6;
        } catch (error: any) {
            logger.error('Error getting TRC20 balance', { address, error: error.message });
            return 0;
        }
    }

    /**
     * 验证 TRON 地址格式
     */
    isValidAddress(address: string): boolean {
        return this.tronWeb.isAddress(address);
    }
}

export const tronService = new TronService();
