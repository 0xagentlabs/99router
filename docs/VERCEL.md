# Vercel 部署说明

## 先说限制

Vercel 适合托管 9Router 的 Dashboard 和短请求 API，不适合运行本项目的常驻能力：

- 本地 MITM、cloudflared、Tailscale 和后台定时刷新不会在 Vercel 上持续运行；
- Vercel 文件系统不可作为数据库，`npm -g` 自更新也不可用；
- `/v1` 的流式响应受 Vercel 函数时长限制，不能当作高并发、长连接代理集群。

因此 Vercel 版本使用 Git 部署更新：上游同步工作流创建 PR，合并后 Vercel 自动重新构建。Dashboard 中的“立即更新”在 Vercel 上会返回明确提示。

## 部署步骤

1. 把本仓库导入 Vercel，Framework 选择 Next.js，保持根目录为项目根目录。
2. 在 Vercel Storage 添加 Postgres（或 Neon）连接，确保项目环境中有 `POSTGRES_URL`。
3. 设置以下环境变量：

   - `JWT_SECRET`：随机长字符串；
   - `INITIAL_PASSWORD`：首次登录密码；
   - `API_KEY_SECRET`、`MACHINE_ID_SALT`：随机长字符串；
   - `REQUIRE_API_KEY=true`；
   - `VERCEL_DB_SNAPSHOT_KEY=default`（同一个数据库部署多个实例时为每个实例设置不同值）。

   `VERCEL=1` 通常由 Vercel 自动注入，不需要手动设置。

4. 部署后访问 `/api/health`，再访问 `/dashboard` 完成登录。

## 数据库实现与限制

为了尽量减少与上游代码的冲突，现有 SQLite 仓库在函数的 `/tmp` 中运行，初始化和写入时把 SQLite 快照保存到 Postgres 的 `_9router_sqlite_snapshots` 表。这个兼容层适合单用户或低并发管理面板；多个函数同时写入时存在“最后一次快照覆盖”的风险。

如果需要多人并发、高流量 `/v1` 或强一致审计，应把 `src/lib/db/repos` 原生迁移到 Postgres，并将路由拆到常驻容器/VPS，而不是继续扩大快照层。

## 跟随 9Router 更新

`.github/workflows/sync-9router-upstream.yml` 每周从 `decolua/9router` 拉取更新并创建 PR。审核冲突后合并到部署分支，Vercel 的 Git 集成会自动重新部署。建议每次上游同步后检查：

- 数据库 schema/migrations；
- Vercel 函数是否仍为 Node runtime；
- 流式 `/v1` 请求和登录；
- 本文件和 `vercel.json` 是否被上游覆盖。
