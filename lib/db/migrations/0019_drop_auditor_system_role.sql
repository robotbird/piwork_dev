-- 审计员系统角色已从产品中移除（种子数据不再创建），清理历史环境残留的角色行；
-- MemberRole 关系由外键 onDelete: cascade 一并清理，Member.role（admin / member）不受影响。
DELETE FROM "Role" WHERE "code" = 'auditor' AND "type" = 'system';
