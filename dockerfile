# Build Stage
FROM debian:bullseye-slim AS builder

RUN echo "Starting builder stage"

# 更新并安装必要的工具
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 安装 Miniconda
RUN wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh -O miniconda.sh \
    && chmod +x miniconda.sh \
    && ./miniconda.sh -b -p /opt/conda \
    && rm miniconda.sh


# 将 conda 添加到 PATH
ENV PATH="/opt/conda/bin:${PATH}"

# 创建 Python 3.8.12 环境并激活
RUN conda create -n py38 python=3.8.12 -y
ENV PATH="/opt/conda/envs/py38/bin:${PATH}"
SHELL ["/bin/bash", "-c"]

# 安装 Rustup 并安装 Rust nightly
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && /root/.cargo/bin/rustup install nightly \
    && /root/.cargo/bin/rustup default nightly

# 安装指定版本的 Node.js (v16.20.2)
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
    && apt-get install -y nodejs=16.20.2* \
    && npm install -g yarn

# 确保 Cargo 和 Rust 编译器在 PATH 中
ENV PATH="/root/.cargo/bin:${PATH}"

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

RUN cargo install --git https://github.com/iden3/circom.git --rev 2eaaa6d --bin circom

# 激活 Python 环境，安装 Node.js 依赖并编译
RUN source activate py38 && \
    yarn install && \
    yarn compile && \
    yarn setup

RUN python3 --version 

# 编译 Rust-CPU
RUN cd rust_backend && \
    echo "Current directory:" && \
    pwd && \
    echo "Directory contents:" && \
    ls -la && \
    echo "Building Rust project:" && \
    cargo build --release
RUN echo "Finished builder stage"

# Run Stage
FROM debian:bullseye-slim AS runner

RUN echo "Starting runner stage"

# 安装指定版本的 Node.js (v16.20.2)
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs=16.20.2* && \
    rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 从构建阶段复制编译好的文件和必要的运行时文件
COPY --from=builder /app/contract /app/contract
COPY --from=builder /app/build /app/build
COPY --from=builder /app/rust_backend/target/release/lib* /app/build/
COPY --from=builder /app/server /app/server
COPY --from=builder /app/node_modules /app/node_modules

# 创建日志目录
RUN mkdir -p ./logs 

# 设置环境变量
ENV RUST_LOG=info

RUN echo "Finished runner stage"

# 启动应用程序并重定向日志，同时确保容器持续运行
CMD nohup node server/server.js > logs/prover.log 2>&1 & \
    tail -f logs/prover.log 