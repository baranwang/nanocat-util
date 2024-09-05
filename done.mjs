import { $platform, _, log } from "./utils.mjs";

export default function done(object = {}) {
    log("", `🚩 执行结束!`, "");
    switch ($platform) {
        case "Surge":
            if (object.policy) _.set(object, "headers.X-Surge-Policy", object.policy);
            $done(object);
            break;
        case "Loon":
            if (object.policy) object.node = object.policy;
            $done(object);
            break;
        case "Stash":
            if (object.policy) _.set(object, "headers.X-Stash-Selected-Proxy", encodeURI(object.policy));
            $done(object);
            break;
        case "Egern":
            $done(object);
            break;
        case "Shadowrocket":
        default:
            $done(object);
            break;
        case "Quantumult X":
            if (object.policy) _.set(object, "opts.policy", object.policy);
            // 移除不可写字段
            delete object["auto-redirect"];
            delete object["auto-cookie"];
            delete object["binary-mode"];
            delete object.charset;
            delete object.host;
            delete object.insecure;
            delete object.method; // 1.4.x 不可写
            delete object.opt; // $task.fetch() 参数, 不可写
            delete object.path; // 可写, 但会与 url 冲突
            delete object.policy;
            delete object["policy-descriptor"];
            delete object.scheme;
            delete object.sessionIndex;
            delete object.statusCode;
            delete object.timeout;
            if (object.body instanceof ArrayBuffer) {
                object.bodyBytes = object.body;
                delete object.body;
            } else if (ArrayBuffer.isView(object.body)) {
                object.bodyBytes = object.body.buffer.slice(object.body.byteOffset, object.body.byteLength + object.body.byteOffset);
                delete object.body;
            } else if (object.body) delete object.bodyBytes;
            $done(object);
            break;
        case "Node.js":
            process.exit(1);
            break;
    }
}
