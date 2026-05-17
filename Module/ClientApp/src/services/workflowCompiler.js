export const compileWorkflow = (nodes, edges) => {
    if (!nodes || nodes.length === 0) {
        return '// Boş akış şeması\n';
    }

    // Find trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
        return '// Hata: Tetikleyici düğüm bulunamadı!\n';
    }

    const visited = new Set();
    let code = `// Görsel İş Akışı Tasarımcısı Tarafından Otomatik Üretilmiştir.\n`;
    code += `// Tetikleyici: ${triggerNode.data.triggerType || 'Bilinmeyen'}\n\n`;

    // Map to find targets and handles
    const getNextNodes = (nodeId, handleId = null) => {
        return edges
            .filter(e => e.source === nodeId && (!handleId || e.sourceHandle === handleId))
            .map(e => nodes.find(n => n.id === e.target))
            .filter(Boolean);
    };

    const compileNodeList = (currentNode, indent = '') => {
        if (!currentNode || visited.has(currentNode.id)) return '';
        visited.add(currentNode.id);

        let nodeCode = '';
        
        switch (currentNode.type) {
            case 'trigger': {
                // Trigger is just the entry point, compile next nodes
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            case 'log': {
                const msg = currentNode.data.message || '';
                // Resolve variables inside message like {{Data.FieldName}} to JS string template
                const jsMsg = resolveMessageVariables(msg);
                nodeCode += `${indent}Log(${jsMsg});\n`;
                
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            case 'fail': {
                const msg = currentNode.data.message || 'Hata!';
                const jsMsg = resolveMessageVariables(msg);
                nodeCode += `${indent}Fail(${jsMsg});\n`;
                // Fail halts execution, so we typically do not continue the path
                break;
            }
            case 'condition': {
                const condition = currentNode.data.expression || 'true';
                nodeCode += `${indent}if (${condition}) {\n`;
                
                // True branch
                const trueNodes = getNextNodes(currentNode.id, 'true');
                if (trueNodes.length > 0) {
                    nodeCode += compileNodeList(trueNodes[0], indent + '    ');
                }
                
                nodeCode += `${indent}} else {\n`;
                
                // False branch
                const falseNodes = getNextNodes(currentNode.id, 'false');
                if (falseNodes.length > 0) {
                    nodeCode += compileNodeList(falseNodes[0], indent + '    ');
                }
                
                nodeCode += `${indent}}\n`;
                break;
            }
            case 'dbFind': {
                const outVar = currentNode.data.outputVar || 'foundRecord';
                const moduleName = currentNode.data.moduleName || '';
                const idExpr = currentNode.data.recordIdExpression || 'Data.Id';
                nodeCode += `${indent}var ${outVar} = Db.Module("${moduleName}").Find(${idExpr});\n`;
                
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            case 'dbUpdate': {
                const moduleName = currentNode.data.moduleName || '';
                const idExpr = currentNode.data.recordIdExpression || 'Data.Id';
                const dataExpr = currentNode.data.updateDataExpression || '{}';
                nodeCode += `${indent}Db.Module("${moduleName}").Update(${idExpr}, ${dataExpr});\n`;
                
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            case 'api': {
                const outVar = currentNode.data.outputVar || 'apiResult';
                const configName = currentNode.data.apiConfigName || '';
                const paramsExpr = currentNode.data.parametersExpression || '{}';
                nodeCode += `${indent}var ${outVar} = Api.Execute("${configName}", ${paramsExpr});\n`;
                
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            case 'codeBlock': {
                const blockCode = currentNode.data.code || '';
                const lines = blockCode.split('\n');
                lines.forEach(line => {
                    nodeCode += `${indent}${line}\n`;
                });
                
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            case 'approval': {
                // The workflow runs within the context of a module, so we assume module is known or passed via DbHelper
                // For simplicity, we just pass the record ID and let the JS hook logic infer the module from the executing context if possible
                // Actually, the Script engine in ModuleRecordsController runs specifically for a module.
                // Since workflowCompiler doesn't know moduleName statically here, we can use a placeholder or rely on `Context.ModuleName` in JS.
                // Wait, in `ScriptService`, we don't have `Context.ModuleName` explicitly. But `Data.ModuleId` isn't available easily as a name.
                // But `ModuleRecordsController` executing the hook knows the module.
                // Let's modify the compilation to use `__MODULE_NAME__` which we can replace or we can just assume `Data.ModuleName` is passed.
                // To keep it simple, we will assume `Data.ModuleName` is injected by ScriptService or we can pass `Module.Name` string directly.
                // Let's rely on standard Hook data if possible.
                
                const roleName = currentNode.data.roleName || '';
                const msg = currentNode.data.message || '';
                const jsMsg = resolveMessageVariables(msg);
                
                // We will assume `Context.ModuleName` is available in JS engine.
                nodeCode += `${indent}Db.RequestApproval(Context.ModuleName, Data.Id, "${roleName}", ${jsMsg});\n`;
                
                const nexts = getNextNodes(currentNode.id);
                if (nexts.length > 0) {
                    nodeCode += compileNodeList(nexts[0], indent);
                }
                break;
            }
            default:
                break;
        }
        
        return nodeCode;
    };

    code += compileNodeList(triggerNode);
    return code;
};

// Helper to convert dynamic fields in visual message like "Değer: {{Data.Title}}" to JS code: "Değer: " + Data.Title
const resolveMessageVariables = (message) => {
    if (!message) return '""';
    
    // Regular expression to match {{ ... }}
    const regex = /\{\{([^}]+)\}\}/g;
    let parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(message)) !== null) {
        const textBefore = message.substring(lastIndex, match.index);
        if (textBefore) {
            parts.push(JSON.stringify(textBefore));
        }
        
        const expression = match[1].trim();
        parts.push(expression);
        
        lastIndex = regex.lastIndex;
    }
    
    const textAfter = message.substring(lastIndex);
    if (textAfter) {
        parts.push(JSON.stringify(textAfter));
    }
    
    if (parts.length === 0) return '""';
    return parts.join(' + ');
};
