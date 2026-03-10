# 快速开始

心流 API 提供与 OpenAI 100% 兼容的接口服务，让您可以无缝切换到我们的 AI 服务，享受更高性能和更具成本效益的解决方案。

------

## 第一步：获取 API 密钥

1. 访问 **[心流官网](https://iflow.cn/?open=setting)** 并完成注册登录
2. 在用户设置页面生成您的专属 API KEY
3. 妥善保存 API KEY，用于后续接口调用

> **💡 提示**：API KEY 具有完整的账户权限，请勿泄露给他人。

## 第二步：了解支持的模型

我们提供多种高性能的 AI 模型供您选择使用。为了获取最新的模型信息、详细参数配置和使用说明，请访问我们的模型页面：

查看完整模型列表

**[点击查看所有支持的模型](https://platform.iflow.cn/models)**

在模型页面，您可以：

- 查看所有可用模型的详细信息
- 了解每个模型的上下文长度和输出限制
- 查看模型的性能特点和适用场景
- 复制 **模型ID** 用于 API 调用

## 第三步：配置接口参数

使用以下配置信息来调用心流 API：

| 参数名称            | 参数值                                      | 说明                                             |
| ------------------- | ------------------------------------------- | ------------------------------------------------ |
| **HTTP URL**        | `https://apis.iflow.cn/v1/chat/completions` | 聊天接口，支持流式和非流式                       |
| **API Key**         | `你的密钥`                                  | 在 [控制台](https://iflow.cn/?open=setting) 获取 |
| **OpenAi Base URL** | `https://apis.iflow.cn/v1`                  | OpenAI SDK使用                                   |

## 第四步：开始调用接口

### 基础示例

以下是使用不同编程语言调用心流 API 的示例：

- OpenAI-Python
- OpenAI-TypeScript
- Bash/cURL
- Python
- JavaScript

```python
from openai import OpenAI

client = OpenAI(
  base_url="https://apis.iflow.cn/v1",
  api_key="<YOUR_IFLOW_API_KEY>",
)

completion = client.chat.completions.create(
  extra_body={},
  model="TBStars2-200B-A13B",
  messages=[
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ]
)
print(completion.choices[0].message.content)
```



# API 手册

## 创建文本对话请求

POST

```
https://apis.iflow.cn/v1/chat/completions
```

**Content-Type:**`application/json`

------

### 请求参数说明

Authorization

- 类型

  `string`

- 位置

  `header`

- 是否必填

  是

- 描述

  使用以下格式进行身份验证：`Bearer <your api key>`（访问[心流](https://iflow.cn/?open=setting)官网登陆获取API KEY）。

------

```
LLM 模型 
```

| 参数名                       | 类型           | 是否必填 | 默认值                                         | 描述                                                         |
| ---------------------------- | -------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `messages`                   | `object[]`     | 是       | -                                              | 构成当前对话的消息列表。                                     |
| `messages.content`           | `string`       | 是       | `中国大模型行业2025年将会迎来哪些机遇和挑战？` | 消息的内容。                                                 |
| `messages.role`              | `enum<string>` | 是       | `user`                                         | 消息作者的角色。 可选值：`user` , `assistant` , `system`     |
| `model`                      | `enum<string>` | 是       | `tstars2.0`                                    | 对应的模型名称。 为更好的提升服务质量，我们将不定期对本服务提供的模型做相关变更，包括但不限于模型上下线、模型服务能力调整，我们会在可行的情况下以公告、消息推送等适当的方式进行通知。 支持的模型请参考快速开始页面。 |
| `frequency_penalty`          | `number`       | 否       | `0.5`                                          | 调整生成 token 的频率惩罚，用于控制重复性。                  |
| `max_tokens`                 | `integer`      | 否       | `512`                                          | 生成的最大 token 数量。 取值范围：`1 < x < 8192`             |
| `n`                          | `integer`      | 否       | `1`                                            | 返回的生成结果数量。                                         |
| `response_format`            | `object`       | 否       | -                                              | 指定模型输出格式的对象。                                     |
| `response_format.type`       | `string`       | 否       | -                                              | 响应格式的类型。                                             |
| `stop`                       | `string[]`     | `null`   | 否                                             | -                                                            |
| `stream`                     | `boolean`      | 否       | `false`                                        | 如果设置为 `true` ，token 将作为服务器发送事件（SSE）逐步返回。 |
| `temperature`                | `number`       | 否       | `0.7`                                          | 控制响应的随机性。值越低，输出越确定；值越高，输出越随机。   |
| `tools`                      | `object[]`     | 否       | -                                              | 模型可能调用的工具列表。目前仅支持函数作为工具。使用此参数提供一个函数列表，模型可能会为其生成 JSON 输入。最多支持 128 个函数。 |
| `tools.function`             | `object`       | 否       | -                                              | 函数对象。                                                   |
| `tools.function.name`        | `string`       | 否       | -                                              | 要调用的函数名称。必须由字母、数字、下划线或短横线组成，最大长度为 64。 |
| `tools.function.description` | `string`       | 否       | -                                              | 函数的描述，用于模型选择何时以及如何调用该函数。             |
| `tools.function.parameters`  | `object`       | 否       | -                                              | 函数接受的参数，描述为 JSON Schema 对象。如果不指定参数，则定义了一个空参数列表的函数。 |
| `tools.function.strict`      | `boolean`      | `null`   | 否                                             | `false`                                                      |
| `tools.type`                 | `enum<string>` | 否       | `function`                                     | 工具的类型。目前仅支持 `function` 。                         |
| `top_k`                      | `number`       | 否       | `50`                                           | 限制 token 选择范围为前 k 个候选。                           |
| `top_p`                      | `number`       | 否       | `0.7`                                          | 核采样参数，用于根据累积概率动态调整每个预测 token 的选择范围。 |

------

### 请求举例

- CURL
- Python
- Javascript
- Java

```bash
curl --request POST \
  --url https://apis.iflow.cn/v1/chat/completions \
  --header 'Authorization: Bearer <iflow API KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "tstars2.0",
  "messages": [
    {
      "role": "user",
      "content": "中国大模型行业2025年将会迎来哪些机遇和挑战？"
    }
  ],
  "stream": false,
  "max_tokens": 512,
  "stop": [
    "null"
  ],
  "temperature": 0.7,
  "top_p": 0.7,
  "top_k": 50,
  "frequency_penalty": 0.5,
  "n": 1,
  "response_format": {
    "type": "text"
  },
  "tools": [
    {
      "type": "function",
      "function": {
        "description": "<string>",
        "name": "<string>",
        "parameters": {},
        "strict": false
      }
    }
  ]
}'
```



------

### 响应参数

- 非流式输出
- 流式输出

| 参数名                          | 类型           | 是否必填 | 默认值 | 描述                                                         |
| ------------------------------- | -------------- | -------- | ------ | ------------------------------------------------------------ |
| `choices`                       | `object[]`     | 是       | -      | 模型生成的选择列表。                                         |
| `choices.finish_reason`         | `enum<string>` | 否       | -      | 生成结束的原因。 可选值： - `stop` : 自然结束。 - `eos` : 到达句子结束符。 - `length` : 达到最大 token 长度限制。 - `tool_calls` : 调用了工具（如函数）。 |
| `choices.message`               | `object`       | 是       | -      | 模型返回的消息对象。                                         |
| `created`                       | `integer`      | 是       | -      | 响应生成的时间戳。                                           |
| `id`                            | `string`       | 是       | -      | 响应的唯一标识符。                                           |
| `model`                         | `string`       | 是       | -      | 使用的模型名称。                                             |
| `object`                        | `enum<string>` | 是       | -      | 响应类型。 可选值： - `chat.completion` : 表示这是一个聊天完成响应。 |
| `tool_calls`                    | `object[]`     | 否       | -      | 模型生成的工具调用，例如函数调用。                           |
| `tool_calls.function`           | `object`       | 否       | -      | 模型调用的函数。                                             |
| `tool_calls.function.arguments` | `string`       | 否       | -      | 函数调用的参数，由模型以 JSON 格式生成。 注意：模型生成的 JSON 可能无效，或者可能会生成不属于函数定义的参数。在调用函数前，请在代码中验证这些参数。 |
| `tool_calls.function.name`      | `string`       | 否       | -      | 要调用的函数名称。                                           |
| `tool_calls.id`                 | `string`       | 否       | -      | 工具调用的唯一标识符。                                       |
| `tool_calls.type`               | `enum<string>` | 否       | -      | 工具的类型。 目前仅支持 `function` 。 可选值： - `function` : 表示这是一个函数调用。 |
| `usage`                         | `object`       | 是       | -      | Token 使用情况统计。                                         |
| `usage.completion_tokens`       | `integer`      | 是       | -      | 完成部分使用的 token 数量。                                  |
| `usage.prompt_tokens`           | `integer`      | 是       | -      | 提示部分使用的 token 数量。                                  |
| `usage.total_tokens`            | `integer`      | 是       | -      | 总共使用的 token 数量。                                      |

------

### 响应信息

- 非流式

```json
        {
          "id": "<string>",
          "choices": [
            {
              "message": {
                "role": "assistant",
                "content": "<string>",
                "reasoning_content": "<string>"
              },
              "finish_reason": "stop"
            }
          ],
          "tool_calls": [
            {
              "id": "<string>",
              "type": "function",
              "function": {
                "name": "<string>",
                "arguments": "<string>"
              }
            }
          ],
          "usage": {
            "prompt_tokens": 123,
            "completion_tokens": 123,
            "total_tokens": 123
          },
          "created": 123,
          "model": "<string>",
          "object": "chat.completion"
        }
```

- 流式

```json
    {"id":"<string>","object":"chat.completion.chunk","created":1694268190,"model":"<string>", "system_fingerprint": "fp_44709d6fcb", "choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}

    {"id":"<string>","object":"chat.completion.chunk","created":1694268190,"model":"<string>", "system_fingerprint": "fp_44709d6fcb", "choices":[{"index":0,"delta":{"content":"Hello"},"logprobs":null,"finish_reason":null}]}

    ....

    {"id":"<string>","object":"chat.completion.chunk","created":1694268190,"model":"<string>", "system_fingerprint": "fp_44709d6fcb", "choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}
```

## 错误码信息

### 举例

| 错误码 | 详情                                                         |
| ------ | ------------------------------------------------------------ |
| 400    | 请求体错误 解决方法：修改请求体解决                          |
| 401    | API KEY 错误 解决方法：请检查您的 API KEY 是否正确，如没有 API KEY，请先创建 [API KEY](https://iflow.cn/?open=setting) |
| 404    | 找不到资源 解决方法：请检查您的请求路径是否正确              |
| 429    | 请求频率过快 解决方法：请稍后重试您的请求                    |
| 503    | 服务器内部错误 解决方法：请等待后重试。若问题一直存在，请联系我们解决 |
| 504    | 服务器过载 解决方法：请稍后重试您的请求                      |



## Temperature设置

```
temperature默认值为1
```

- 建议您根据您的场景按如下表格选择合适的设置。

| 场景                | 温度 |
| ------------------- | ---- |
| 代码生成/数学解题   | 0.0  |
| 数据抽取/分析       | 1.0  |
| 通用对话            | 1.3  |
| 翻译                | 1.3  |
| 创意类写作/诗歌创作 | 1.5  |

## 限速

### 当前限流策略

目前，我们的限流规则如下：
每个用户最多只能**同时发起一个**请求，超出限制的请求会返回429错误码。
当前服务**免费使用**，但请合理使用资源，避免不必要的高并发请求。

| 并发限制   | 描述                                                       |
| ---------- | ---------------------------------------------------------- |
| 流式请求   | 主动取消后立即释放令牌，推荐使用流式请求以提高效率。       |
| 非流式请求 | 主动取消后，模型实际仍在运行，需等待运行完毕后才释放令牌。 |

### 推荐使用方式

优先使用流式请求：流式请求在主动取消后会立即释放令牌，能够更高效地利用资源。




# 模型
iFlow-ROME

iFlow-ROME是基于ALE（Agentic Learning Ecosystem）生态系统训练的开源智能体模型。采用30B MoE架构，仅激活3B参数，通过百万级轨迹数据训练。模型在终端任务、软件工程和工具使用等场景表现出色，在SWE-bench Verified达到57.4%准确率，Terminal-Bench 2.0达到24.72%。突破了同等规模模型性能上限，可媲美百亿级参数模型

上下文窗口:

256K

|

最大输出:

64K

Qwen3-Coder-Plus

Qwen3-Coder-Plus，这是一个总参数量 480B，激活 35B 的 MoE 模型，原生支持 256K token 的上下文并可通过 YaRN 扩展到 1M token，拥有卓越的代码和 Agent 能力。Qwen3-Coder-480B-A35B-Instruct 在 Agentic Coding、Agentic Browser-Use 和 Agentic Tool-Use 上取得了开源模型的 SOTA 效果，可以与 Claude Sonnet4 媲美

上下文窗口:

1M

|

最大输出:

64K

Qwen3-Max

通义千问3系列Max模型，相较preview版本在智能体编程与工具调用方向进行了专项升级。本次发布的正式版模型达到领域SOTA水平，适配场景更加复杂的智能体需求。

上下文窗口:

256K

|

最大输出:

32K

Qwen3-VL-Plus

Qwen3-VL 系列——这是迄今为止 Qwen 系列中最强大的视觉语言模型。 这一代模型在多个维度实现了全面跃升：无论是纯文本理解与生成，还是视觉内容的感知与推理；无论是上下文长度的支持能力，还是对空间关系、动态视频的理解深度；乃至在与Agent交互中的表现，Qwen3-VL 都展现出显著进步。

上下文窗口:

256K

|

最大输出:

32K

Kimi-K2-Instruct-0905

Kimi K2-Instruct-0905，由月之暗面研发的开源万亿参数MoE模型。激活参数达320亿，采用混合专家架构，支持256K超长上下文，具备卓越的编码智能与工具调用能力，尤其在前端开发与多语言编程任务中表现突出。

上下文窗口:

256K

|

最大输出:

64K

Qwen3-Max-Preview

通义千问3系列Max模型Preview版本，相较2.5系列整体通用能力有大幅度提升，中英文通用文本理解能力、复杂指令遵循能力、主观开放任务能力、多语言能力、工具调用能力均显著增强；模型知识幻觉更少。

上下文窗口:

256K

|

最大输出:

32K
 Kimi-K2

kimi-k2 是一款具备超强代码和 Agent 能力的 MoE 架构基础模型，总参数 1T，激活参数 32B。在通用知识推理、编程、数学、Agent 等主要类别的基准性能测试中，K2 模型的性能超过其他主流开源模型

上下文窗口:

128K

|

最大输出:

64K

DeepSeek-V3.2-Exp

DeepSeek-V3.2-Exp 模型，这是一个实验性（Experimental）的版本。作为迈向新一代架构的中间步骤，V3.2-Exp 在 V3.1-Terminus 的基础上引入了 DeepSeek Sparse Attention（一种稀疏注意力机制），针对长文本的训练和推理效率进行了探索性的优化和验证

上下文窗口:

128K

|

最大输出:

64K

DeepSeek-R1

DeepSeek-R1，是深度求索研发的推理模型。DeepSeek-R1采用强化学习进行后训练，旨在提升推理能力，尤其擅长数学、代码和自然语言推理等复杂任务

上下文窗口:

32K

|

最大输出:

128K

DeepSeek-V3-671B

DeepSeek-V3 模型，671B 参数，激活 37B，在 14.8T token 上进行了预训练。DeepSeek-V3 多项评测成绩超越了 Qwen2.5-72B 和 Llama-3.1-405B 等其他开源模型，并在性能上和世界顶尖的闭源模型 GPT-4o 以及 Claude-3.5-Sonnet 不分伯仲。

上下文窗口:

128K

|

最大输出:

32K

Qwen3-32B

Qwen3-32B是一款拥有 320 亿参数的模型，其性能可与具备 6710 亿参数（其中 370 亿被激活）的 DeepSeek-R1 媲美。这一成果突显了将强化学习应用于经过大规模预训练的强大基础模型的有效性。

上下文窗口:

128K

|

最大输出:

32K

Qwen3-235B-A22B-Thinking

Qwen3-235B-A22B-Thinking-2507，其主要增强功能如下： 在推理任务上的性能显著提高，包括逻辑推理、数学、科学、编码和通常需要人类专业知识的学术基准——在开源思维模型中取得最先进的成果。 明显更好的通用能力，例如指令遵循、工具使用、文本生成和与人类偏好的一致性。 增强了256K长上下文理解能力。

上下文窗口:

256K

|

最大输出:

64K

Qwen3-235B-A22B-Instruct

Qwen3-235B-A22B 是 Qwen 系列中最新一代大型语言模型，提供全面的密集模型和混合专家 (MoE) 模型。Qwen3 基于丰富的训练经验，在推理、指令遵循、代理能力和多语言支持方面取得了突破性进展

上下文窗口:

256K

|

最大输出:

64K

Qwen3-235B-A22B

Qwen3-235B-A22B 是 Qwen 系列中最新一代大型语言模型，提供全面的密集模型和混合专家 (MoE) 模型。Qwen3 基于丰富的训练经验，在推理、指令遵循、代理能力和多语言支持方面取得了突破性进展

上下文窗口:

128K

|

最大输出:

32K