[English](./README.md) | 简体中文

# Task Orchestrator

Task Orchestrator 是一个小型、provider-neutral 的基础组件，供需要协调由外部 worker 执行的持久化编码任务的应用使用。

## 提供的能力

- 用于启动、继续、检查、恢复和取消工作的严格 worker contract。
- 在继续执行时保持稳定的不透明 worker handle。
- 具备终态保护的紧凑状态词汇表。
- 将持久化任务记录映射到本仓库中性 worker contract 的辅助工具。
- 将具体集成保留在核心之外的 adapter resolver。

调用应用负责持久化、调度、认证、用户交互以及 worker 实现的选择。Worker adapter 负责其协议细节，并将其转换为本仓库中的 contract。

```text
调用应用
        |
        v
 持久化任务状态 <----> Worker contract <----> 外部 worker adapter
```

## 安装与验证

要求：Node.js 18 或更高版本。该项目没有生产依赖。

```sh
npm test
npm run check
```

随附的测试使用离线 fixtures。它们不会连接外部服务、启动 worker 进程，也不需要凭据。

## 配置

仅当部署需要默认工作区路径时，才将 `.env.example` 复制为 `.env`。请将 `.env`、运行时状态、凭据和执行记录保留在版本控制之外。

## 范围

本仓库有意提供 contracts 和边界辅助工具，而非完整的执行产品。它不包含用户界面、内置 worker runtime、凭据、自动 worker 选择或网络传输。

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。请保持新增内容 provider-neutral，并确保默认验证保持离线。

## 安全

有关负责任披露的指南，请参见 [SECURITY.md](SECURITY.md)。

## 许可证

本项目以 [MIT License](LICENSE) 发布。
