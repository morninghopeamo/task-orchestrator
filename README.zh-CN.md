[English](./README.md) | 简体中文

# Task Orchestrator

**Task Orchestrator 是一个持久化编排层，用于将长时间运行的工作委派给可由外部控制的 AI worker。**

调用应用可以专注于判断、任务拆解和监督，worker 则负责被委派的工作。本仓库提供 provider-neutral 的 contract 和边界辅助工具，把这次委派收敛为一条可持久化的任务生命周期，无需由调用方亲自处理每一次中断、继续执行和 worker 会话。

## 示例工作流

主 Agent 可以通过显式配置的 ACP stdio profile，将任务提交给仓库内置的 ACP Reference Worker。

```text
主 Agent / 调用应用
        |
        | 委派实现任务
        v
Task Orchestrator
        |
        | 持久化任务记录 + 生命周期监督
        v
ACP Reference Worker
```

例如，主 Agent 可以先把一个功能拆成任务并交给 worker，再检查进度、继续已中断的工作、恢复原有会话，或取消任务；整个过程中，它面对的是一条稳定的任务生命周期。

仓库内置的 ACP Reference Worker 使用由操作者提供的 ACP stdio 命令。它不会发现可执行文件、凭据或会话；profile 未明确 opt-in 时也不会启动进程。

## 为什么需要 Task Orchestrator

外部 worker 并不总是一次调用就立即返回：一个任务可能运行很久、停下来等待新的指令、连接中断，或在受阻后需要恢复之前的会话。若直接逐个集成，provider 专属的会话 ID、状态名称和恢复规则很容易渗入调用应用。

Task Orchestrator 为这些问题提供一个中性边界：一条可持久化的任务记录、一个稳定的 worker handle，以及一套小而明确的生命周期。应用仍然掌握自己的存储和调度；adapter 则在边界处转换各个 worker 的协议。

## 架构

```text
Job
 |
 v
Worker Resolver
 |
 v
Worker Admission Contract
 |
 v
ACP Reference Worker（参考集成）
 |
 v
可寻址会话 / 同一会话 continuation
 |
 v
结构化 Result
```

调用应用负责持久化、调度、认证和用户交互。核心 contract 负责持久化生命周期与不透明的 worker handle；adapter 负责各 provider 的协议边界。

## 它提供什么

- 为 `start`、`continue`、`inspect`、`recover` 和 `cancel` 定义严格的 worker contract。
- 将持久化任务记录映射到紧凑、provider-neutral 的 worker 状态词汇表。
- 要求 worker handle 保持不透明且稳定，可跨继续执行、检查、恢复和取消操作使用。
- 保护终态（`completed`、`failed`、`cancelled`），使任务生命周期保持明确。
- 提供 durable JSON job store、detached supervisor 和公开的 `run` 入口。
- 从外部的序列化 profile 重建 ACP Reference Worker；durable job 不保存命令路径、环境或凭据。
- 提供离线 conformance probe，用于验证 adapter 是否符合 contract。

## 任务生命周期与监督模型

```text
start --> running --> stopped / running --continue--> completed
                  \--inspect--> 当前状态
                  \--recover--> 当前状态
                  \--cancel--> cancelled

completed / failed / cancelled 为终态。
```

adapter 在整个任务过程中报告 worker 的规范状态，并保留同一个不透明 handle。可恢复的中断（`stopped`）仍是可继续的活跃状态，可接收同一会话的 continuation；它不是终态失败。调用应用自行决定何时持久化任务、安排继续执行、请求恢复，或向用户展示进度。这样的分层避免 worker 专属协议细节成为应用自己的任务模型。

## 安装与验证

要求：Node.js 18 或更高版本。该项目没有生产依赖。

```sh
git clone https://github.com/morninghopeamo/task-orchestrator.git
cd task-orchestrator
node --version
npm test
npm run check
```

默认验证不需要 `npm install`，因为仓库没有依赖。随附的测试使用离线 fixtures：它们不会连接外部服务或使用凭据；ACP 测试只启动合成的本地 fixture 进程。

## 配置

仅当部署需要默认工作区路径时，才将 `.env.example` 复制为 `.env`。请将 `.env`、运行时状态、凭据和执行记录保留在版本控制之外。

## 当前范围与 adapter 边界

本仓库有意提供一条窄执行路径，而非完整的执行产品。它不包含用户界面、内置 worker runtime、凭据、自动 worker 选择、HTTP transport、调度、重试、fallback 或 multi-worker routing。

ACP Reference Worker 仍位于 `core/` 之外；操作者在 profile 文件中提供明确的 command、args 和 environment。仅克隆本仓库不会自动连接任何 worker。

## Worker 准入契约

Task Orchestrator 通过显式的准入与 transport contract 支持 worker；它不是通用桌面 Agent 包装器，也不是 GUI automation 框架。adapter 在被解析前，必须显式声明以下五项能力：

- 可靠的外部控制。
- 可寻址的会话身份。
- 同一会话的 continuation。
- 结构化的执行可观测性。
- 确定性的中断语义。

只有面向人类的 GUI、但没有稳定程序化控制和会话表面的 worker，不在支持的集成边界内。

## ACP Reference Worker

ACP Reference Worker 是一个参考集成，不代表所有 ACP agent 都受支持。它使用结构化、由协议驱动的 ACP stdio transport；continuation 会复用同一个可寻址会话；默认测试使用确定性的本地 fixture。操作者在 profile 文件中提供 command、args、environment 和显式的进程启动 opt-in。本仓库不会发现可执行文件、凭据或会话。

## 证据边界

默认仓库验证的证据等级为 **OFFLINE + STATIC**。它验证 contract 与确定性 fixture 行为，但不执行真实的外部 provider，因此不得理解为 live-provider 验证。

## 非目标

- GUI automation 或通用桌面 Agent 控制。
- provider 专属 scraping、未文档化 hack 或凭据发现。
- 隐藏的人类介入式 continuation。
- 通用 ACP runtime 或兼容性承诺。

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。请保持新增内容 provider-neutral，并确保默认验证保持离线。

## 安全

有关负责任披露的指南，请参见 [SECURITY.md](SECURITY.md)。

## 许可证

本项目以 [MIT License](LICENSE) 发布。
