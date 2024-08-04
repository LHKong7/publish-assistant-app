import Koa from 'koa';
import KoaRouter from 'koa-router';
import koaBody from 'koa-body';
import path from 'node:path';

// 最新 node 核心包的导入写法
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
// 获取 __filename 的 ESM 写法
const __filename = fileURLToPath(import.meta.url)
// 获取 __dirname 的 ESM 写法
const __dirname = dirname(fileURLToPath(import.meta.url))


// LLM related:
import { ChatOllama } from "@langchain/community/chat_models/ollama";

const chatModel = new ChatOllama({
    baseUrl: "http://localhost:11434", // Default value
    model: "codellama:13b",
});

// PDF related:
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const app = new Koa();
const kRouter = new KoaRouter();

app.use(koaBody.koaBody({
	multipart: true, // 支持文件上传
	encoding: 'gzip',
	formidable: {
		uploadDir: path.join(__dirname, 'public/upload/'), // 设置文件上传目录
		keepExtensions: true, // 保持文件的后缀
		maxFieldsSize: 2 * 1024 * 1024, // 文件上传大小
		onFileBegin: (name, file) => { // 文件上传前的设置
			// console.log(`name: ${name}`);
			// console.log(file);
		},
	}
}));

app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type');
    await next();
});
  

// logger
app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.get('X-Response-Time');
    console.log(`${ctx.methd} ${ctx.url} - ${rt}`);
});

app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});

// upload file
kRouter.post('/upload/prd', async (ctx, next) => {
    // obtain file:
    const file = ctx.request.files.file;

    const loader = new PDFLoader(file.filepath)
    const docs = await loader.load();
    const codeLLMMsg = await chatModel.invoke(`Assume you are a front-end software engineering, generate code from the following content: ${docs[0].pageContent}`)

    const testLLMMsg = await chatModel.invoke(`Assume you are a program, generate test code from the following content by using jest framework: ${codeLLMMsg.content}`)


    if (!file) {
        ctx.body = JSON.parse(JSON.stringify({
            data: 'invalid file'
        }))
    }

    ctx.body = JSON.parse(JSON.stringify({
        data: testLLMMsg.content
    }))
});


app
  .use(kRouter.routes())
  .use(kRouter.allowedMethods());

app.listen(9001);
