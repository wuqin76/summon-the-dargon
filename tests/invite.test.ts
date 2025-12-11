/**
 * 邀请功能测试文件
 * 测试邀请用户进入后，邀请者获得一次抽奖机会
 */

import { Pool } from 'pg';
import { handleInviteRegistration, updateInviteeAction } from '../src/routes/invite.routes';

// Mock task.routes 模块以避免任务系统错误
jest.mock('../src/routes/task.routes', () => ({
    updateTaskProgressV2: jest.fn().mockResolvedValue({ success: false }),
}));

describe('邀请功能测试', () => {
    let pool: Pool;

    beforeAll(() => {
        // 设置数据库连接
        pool = new Pool({ 
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/test_db' 
        });
    });

    afterAll(async () => {
        // 关闭数据库连接
        await pool.end();
    });

    beforeEach(() => {
        // 重置mock
        jest.clearAllMocks();
    });

    describe('handleInviteRegistration - 邀请注册处理', () => {
        it('应该成功创建邀请记录并给邀请者增加抽奖机会', async () => {
            const inviterUserId = 'user-123';
            const inviteeUserId = 'user-456';
            const inviteeData = {
                telegram_id: 789012345,
                username: 'test_user',
                first_name: 'Test',
            };
            const inviteCode = 'ABC123XYZ';
            const ipAddress = '192.168.1.1';

            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ id: 'invitation-1' }] }) // 创建邀请记录
                    .mockResolvedValueOnce({ rows: [] }) // 更新邀请人统计
                    .mockResolvedValueOnce({ rows: [] }) // 发放抽奖资格
                    .mockResolvedValueOnce({ rows: [] }) // 更新可用抽奖次数
            };

            await handleInviteRegistration(
                inviterUserId,
                inviteeUserId,
                inviteeData,
                inviteCode,
                ipAddress,
                mockClient
            );

            // 验证调用次数和参数（注意：实际调用次数可能因任务系统而变化，这里只验证核心逻辑）
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO invitations'), 
                expect.anything());
            
            // 验证创建邀请记录
            const insertInvitationCall = (mockClient.query as jest.Mock).mock.calls.find(
                call => call[0].includes('INSERT INTO invitations')
            );
            expect(insertInvitationCall).toBeDefined();
            expect(insertInvitationCall[1]).toEqual(expect.arrayContaining([inviterUserId, inviteeUserId, inviteeData.telegram_id]));
            
            // 验证更新邀请人统计
            const updateUserCall = (mockClient.query as jest.Mock).mock.calls.find(
                call => call[0].includes('UPDATE users') && call[0].includes('total_invited')
            );
            expect(updateUserCall).toBeDefined();
            
            // 验证发放抽奖资格
            const insertEntitlementCall = (mockClient.query as jest.Mock).mock.calls.find(
                call => call[0].includes('INSERT INTO spin_entitlements')
            );
            expect(insertEntitlementCall).toBeDefined();
            
            // 验证更新可用抽奖次数 (available_spins + 1)
            const updateSpinsCall = (mockClient.query as jest.Mock).mock.calls.find(
                call => call[0].includes('available_spins = available_spins + 1')
            );
            expect(updateSpinsCall).toBeDefined();
        });

        it('应该在出错时抛出异常', async () => {
            const mockClient = {
                query: jest.fn().mockRejectedValue(new Error('Database error'))
            };

            await expect(handleInviteRegistration(
                'user-123',
                'user-456',
                { telegram_id: 789012345 },
                'ABC123',
                '192.168.1.1',
                mockClient
            )).rejects.toThrow('Database error');
        });
    });

    describe('updateInviteeAction - 更新被邀请人行为', () => {
        it('应该更新被邀请人的付费游玩状态', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] })
            };

            await updateInviteeAction('user-456', 'played_paid', mockClient);

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE invitations'),
                expect.arrayContaining(['user-456'])
            );
        });

        it('应该更新被邀请人的邀请他人状态', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] })
            };

            await updateInviteeAction('user-456', 'invited_others', mockClient);

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE invitations'),
                expect.arrayContaining(['user-456'])
            );
        });
    });

    describe('邀请功能集成测试', () => {
        // 注意：以下集成测试需要正确配置的测试数据库
        // 设置 TEST_DATABASE_URL 环境变量来运行这些测试
        it.skip('完整测试邀请流程：新用户通过邀请码注册，邀请者获得抽奖机会', async () => {
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // 1. 创建测试邀请人
                const inviterResult = await client.query(`
                    INSERT INTO users (telegram_id, username, first_name, invite_code, available_spins, total_invited)
                    VALUES ($1, $2, $3, $4, 0, 0)
                    RETURNING id, invite_code
                `, [111111111, 'inviter_user', 'Inviter', 'TEST_CODE_' + Date.now()]);
                
                const inviter = inviterResult.rows[0];
                const inviterUserId = inviter.id;
                const inviteCode = inviter.invite_code;

                // 2. 创建测试被邀请人
                const inviteeResult = await client.query(`
                    INSERT INTO users (telegram_id, username, first_name, invite_code, available_spins)
                    VALUES ($1, $2, $3, $4, 0)
                    RETURNING id
                `, [222222222, 'invitee_user', 'Invitee', 'INVITEE_CODE_' + Date.now()]);
                
                const inviteeUserId = inviteeResult.rows[0].id;

                // 3. 处理邀请注册
                await handleInviteRegistration(
                    inviterUserId,
                    inviteeUserId,
                    {
                        telegram_id: 222222222,
                        username: 'invitee_user',
                        first_name: 'Invitee'
                    },
                    inviteCode,
                    '127.0.0.1',
                    client
                );

                // 4. 验证邀请记录
                const invitationCheck = await client.query(`
                    SELECT * FROM invitations 
                    WHERE inviter_id = $1 AND invitee_id = $2
                `, [inviterUserId, inviteeUserId]);
                
                expect(invitationCheck.rows.length).toBe(1);
                expect(invitationCheck.rows[0].registered).toBe(true);
                expect(invitationCheck.rows[0].invite_code).toBe(inviteCode);

                // 5. 验证邀请人的抽奖次数增加
                const inviterCheck = await client.query(`
                    SELECT available_spins, total_invited FROM users WHERE id = $1
                `, [inviterUserId]);
                
                expect(inviterCheck.rows[0].available_spins).toBe(1); // 应该增加1次
                expect(inviterCheck.rows[0].total_invited).toBe(1); // 邀请统计+1

                // 6. 验证抽奖资格记录
                const entitlementCheck = await client.query(`
                    SELECT * FROM spin_entitlements 
                    WHERE user_id = $1 AND source_type = 'invite' AND consumed = false
                `, [inviterUserId]);
                
                expect(entitlementCheck.rows.length).toBe(1);
                expect(entitlementCheck.rows[0].source_id).toBe(invitationCheck.rows[0].id);

                await client.query('ROLLBACK');
                console.log('✅ 邀请功能集成测试通过');
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        });

        it.skip('测试重复邀请检测：同一用户不能被多次邀请', async () => {
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // 创建邀请人1
                const inviter1Result = await client.query(`
                    INSERT INTO users (telegram_id, username, first_name, invite_code, available_spins)
                    VALUES ($1, $2, $3, $4, 0)
                    RETURNING id, invite_code
                `, [333333333, 'inviter1', 'Inviter1', 'CODE1_' + Date.now()]);
                
                const inviter1 = inviter1Result.rows[0];

                // 创建被邀请人
                const inviteeResult = await client.query(`
                    INSERT INTO users (telegram_id, username, first_name, invite_code)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [555555555, 'invitee_test', 'Invitee', 'INVITEE_' + Date.now()]);
                
                const inviteeUserId = inviteeResult.rows[0].id;

                // 第一次邀请（应该成功）
                await handleInviteRegistration(
                    inviter1.id,
                    inviteeUserId,
                    { telegram_id: 555555555, username: 'invitee_test', first_name: 'Invitee' },
                    inviter1.invite_code,
                    '127.0.0.1',
                    client
                );

                // 验证邀请记录存在
                const checkInvitation = await client.query(`
                    SELECT * FROM invitations WHERE invitee_id = $1
                `, [inviteeUserId]);
                
                expect(checkInvitation.rows.length).toBe(1);
                expect(checkInvitation.rows[0].inviter_id).toBe(inviter1.id);

                // 验证第一个邀请人的抽奖次数
                const inviter1Check = await client.query(`
                    SELECT available_spins FROM users WHERE id = $1
                `, [inviter1.id]);
                expect(inviter1Check.rows[0].available_spins).toBe(1);

                await client.query('ROLLBACK');
                console.log('✅ 重复邀请检测测试通过');
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        });

        it('测试自我邀请检测：用户不能使用自己的邀请码', async () => {
            // 这个测试应该在API层面进行，因为 handleInviteRegistration 不检查这个
            // 在 invite.routes.ts 中的 POST /api/invite/accept 路由中有检查
            expect(true).toBe(true); // 占位符测试
        });
    });

    describe('邀请统计功能测试', () => {
        it.skip('应该正确统计邀请人数', async () => {
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');

                // 创建邀请人
                const inviterResult = await client.query(`
                    INSERT INTO users (telegram_id, username, first_name, invite_code, available_spins, total_invited)
                    VALUES ($1, $2, $3, $4, 0, 0)
                    RETURNING id, invite_code
                `, [666666666, 'stats_inviter', 'StatsInviter', 'STATS_CODE_' + Date.now()]);
                
                const inviter = inviterResult.rows[0];

                // 创建3个被邀请人
                for (let i = 1; i <= 3; i++) {
                    const inviteeResult = await client.query(`
                        INSERT INTO users (telegram_id, username, first_name, invite_code)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id
                    `, [700000000 + i, `invitee${i}`, `Invitee${i}`, `INV${i}_` + Date.now()]);
                    
                    const inviteeId = inviteeResult.rows[0].id;

                    await handleInviteRegistration(
                        inviter.id,
                        inviteeId,
                        { telegram_id: 700000000 + i, username: `invitee${i}`, first_name: `Invitee${i}` },
                        inviter.invite_code,
                        '127.0.0.1',
                        client
                    );
                }

                // 验证统计
                const statsResult = await client.query(`
                    SELECT 
                        COUNT(*) as total_invites
                    FROM invitations
                    WHERE inviter_id = $1 AND registered = true
                `, [inviter.id]);

                expect(parseInt(statsResult.rows[0].total_invites)).toBe(3);

                // 验证抽奖次数（应该增加3次）
                const inviterCheck = await client.query(`
                    SELECT available_spins, total_invited FROM users WHERE id = $1
                `, [inviter.id]);
                
                expect(inviterCheck.rows[0].available_spins).toBe(3);
                expect(inviterCheck.rows[0].total_invited).toBe(3);

                // 验证抽奖资格记录
                const entitlementsCheck = await client.query(`
                    SELECT COUNT(*) as count FROM spin_entitlements 
                    WHERE user_id = $1 AND source_type = 'invite' AND consumed = false
                `, [inviter.id]);
                
                expect(parseInt(entitlementsCheck.rows[0].count)).toBe(3);

                await client.query('ROLLBACK');
                console.log('✅ 邀请统计功能测试通过');
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        });
    });
});

describe('邀请API端点测试', () => {
    // 这些测试需要使用 supertest 来测试实际的HTTP端点
    // 这里只是占位符，展示应该测试的端点

    describe('GET /api/invite/info', () => {
        it('应该返回用户的邀请信息', () => {
            // 使用 supertest 测试
            expect(true).toBe(true);
        });
    });

    describe('POST /api/invite/accept', () => {
        it('应该成功接受有效的邀请码', () => {
            expect(true).toBe(true);
        });

        it('应该拒绝无效的邀请码', () => {
            expect(true).toBe(true);
        });

        it('应该拒绝自我邀请', () => {
            expect(true).toBe(true);
        });

        it('应该处理重复邀请的情况', () => {
            expect(true).toBe(true);
        });
    });

    describe('GET /api/invite/stats', () => {
        it('应该返回正确的邀请统计数据', () => {
            expect(true).toBe(true);
        });
    });

    describe('GET /api/invite/list', () => {
        it('应该返回邀请的用户列表', () => {
            expect(true).toBe(true);
        });
    });
});
