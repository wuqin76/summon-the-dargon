/**
 * TronWeb 类型声明
 * 由于官方没有提供完整的 TypeScript 类型定义，这里提供基本的类型声明
 */

declare module 'tronweb' {
    export interface TronWebOptions {
        fullHost?: string;
        privateKey?: string;
        headers?: Record<string, string>;
    }

    export interface Transaction {
        txID: string;
        raw_data: {
            contract: Array<{
                type: string;
                parameter: {
                    value: {
                        owner_address?: string;
                        to_address?: string;
                        amount?: number;
                        data?: string;
                    };
                };
            }>;
        };
        raw_data_hex: string;
        signature: string[];
    }

    export interface TransactionInfo {
        id: string;
        blockNumber: number;
        blockTimeStamp: number;
        contractResult: string[];
        receipt: {
            result: string;
        };
        log: Array<{
            address: string;
            topics: string[];
            data: string;
        }>;
    }

    export interface Contract {
        name(): { call(): Promise<string> };
        symbol(): { call(): Promise<string> };
        decimals(): { call(): Promise<number> };
        balanceOf(address: string): { call(): Promise<number> };
        transfer(to: string, amount: number | string): {
            send(options?: { feeLimit?: number }): Promise<string>;
        };
    }

    class TronWeb {
        constructor(options: TronWebOptions | string);
        
        static fromPrivateKey(privateKey: string, fullHost?: string): TronWeb;
        
        address: {
            fromHex(address: string): string;
            toHex(address: string): string;
        };
        
        trx: {
            getTransaction(txHash: string): Promise<Transaction>;
            getTransactionInfo(txHash: string): Promise<TransactionInfo>;
            getBalance(address: string): Promise<number>;
            getConfirmedTransaction(txHash: string): Promise<Transaction>;
            getCurrentBlock(): Promise<{ block_header: { raw_data: { number: number } } }>;
        };
        
        contract(): {
            at(address: string): Promise<Contract>;
        };
        
        isAddress(address: string): boolean;
        
        setHeader(headers: Record<string, string>): void;
        
        setPrivateKey(privateKey: string): void;
    }

    export default TronWeb;
}
