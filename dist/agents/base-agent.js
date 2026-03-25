"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
class BaseAgent {
    id;
    agentType;
    constructor(id, agentType) {
        this.id = id;
        this.agentType = agentType;
        // capabilities is defined by subclass
    }
    async callClaude(prompt) {
        // Placeholder - 子类实现
        throw new Error('BaseAgent.callClaude must be implemented by subclass');
    }
}
exports.BaseAgent = BaseAgent;
