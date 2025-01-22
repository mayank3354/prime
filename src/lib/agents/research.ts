import { WebBrowser } from "langchain/tools/webbrowser";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Calculator } from "@langchain/community/tools/calculator";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {  SystemMessage,  } from "@langchain/core/messages";
//import { z } from "zod";

// Define the graph state
const GraphState = MessagesAnnotation;

export async function researchAgent(query: string) {
  // Initialize Gemini model
  const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-pro",
    apiKey: process.env.GOOGLE_API_KEY!,
    maxOutputTokens: 2048,
    temperature: 0.7,
  });

  // Initialize Google embeddings
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY!,
    modelName: "models/embedding-001", // Google's text embedding model
  });

  // Initialize web browser with Google embeddings
  const webBrowser = new WebBrowser({ 
    model, 
    embeddings,
    //maxTextLength: 8000,
    //maxIterations: 2,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
    },
  });

  const tools = [webBrowser, new Calculator()];
  const toolNode = new ToolNode(tools);

  // Simplified main research prompt
  const researchPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a fast and efficient research assistant. Focus on:
1. Quick identification of key information
2. Prioritize recent and highly relevant sources
3. Summarize findings concisely
4. Use tools efficiently and minimize iterations`],
    ["human", "{input}"],
    ["assistant", "I'll research this quickly and efficiently."],
    ["human", "Available tools: {tool_names}"],
    ["placeholder", "{agent_scratchpad}"]
  ]);

  // Specialized agent prompts
  // const paperReaderPrompt = ChatPromptTemplate.fromMessages([...]);
  // const relevanceAnalyzerPrompt = ChatPromptTemplate.fromMessages([...]);
  // const recencyCheckerPrompt = ChatPromptTemplate.fromMessages([...]);

  // Specialized agent nodes
  // async function paperReaderNode(state: typeof GraphState.State) {...}
  // async function relevanceAnalyzerNode(state: typeof GraphState.State) {...}
  // async function recencyCheckerNode(state: typeof GraphState.State) {...}

  // Define the main agent node
  async function agentNode(state: typeof GraphState.State) {
    console.log("Executing main agent...");
    const agentModel = new ChatGoogleGenerativeAI({
      modelName: "gemini-pro",
      temperature: 0.3,
      apiKey: process.env.GOOGLE_API_KEY!,
    });

    const formattedMessages = await researchPrompt.formatMessages({
      input: state.messages[state.messages.length - 1].content,
      tool_names: tools.map(t => t.name).join(", "),
      agent_scratchpad: ""
    });

    const response = await agentModel.invoke(formattedMessages);
    return { messages: [...state.messages, response] };
  }

  // Optimize routing logic
  function shouldContinue(state: typeof GraphState.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    
    if (lastMessage.additional_kwargs?.tool_calls) {
      return "tools";
    }

    const content = typeof lastMessage.content === 'string' 
      ? lastMessage.content.toLowerCase()
      : JSON.stringify(lastMessage.content).toLowerCase();

    // Simplified routing with fewer iterations
    if (state.messages.length > 4) {
      return "end";
    }

    // Combine checks to reduce node transitions
    if (content.includes("research") || content.includes("paper") || 
        content.includes("relevance") || content.includes("recent")) {
      return "process_all";
    }

    return "agent";
  }

  // Combined processing node for faster execution
  async function processAllNode(state: typeof GraphState.State) {
    console.log("Processing research, relevance, and recency...");
    
    const lastContent = state.messages[state.messages.length - 1].content;
    const combinedPrompt = ChatPromptTemplate.fromMessages([
      ["system", `Analyze this information comprehensively:
1. Extract key findings (focus on last 2 years)
2. Assess relevance (High/Medium/Low)
3. Check publication dates
4. Evaluate credibility (1-5)

Provide a concise, structured response.`],
      ["human", lastContent],
    ]);

    const formattedMessages = await combinedPrompt.formatMessages({
      input: lastContent
    });

    const response = await model.invoke(formattedMessages);
    return { messages: [...state.messages, response] };
  }

  // Streamlined workflow graph
  const workflow = new StateGraph(GraphState)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addNode("process_all", processAllNode)
    .addEdge("__start__", "agent")
    .addEdge("tools", "agent")
    .addEdge("process_all", "agent")
    .addConditionalEdges(
      "agent",
      shouldContinue,
      {
        tools: "tools",
        process_all: "process_all",
        agent: "agent",
        end: "__end__"
      }
    );

  // Compile the workflow
  const app = workflow.compile();

  try {
    // Execute the research workflow
    const finalState = await app.invoke({
      messages: [
        new SystemMessage(`Research Query: ${query}
Please conduct thorough research using available tools.
Provide specific citations and evidence for all findings.`),
      ]
    });

    // Process the final response
    const lastMessage = finalState.messages[finalState.messages.length - 1];
    
    try {
      // Try to parse as structured data
      const content = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);

      return {
        summary: content,
        findings: extractFindings(content),
        references: extractReferences(content)
      };
    } catch (error) {
      console.error("Error parsing research results:", error);
      return {
        summary: lastMessage.content,
        findings: [],
        references: []
      };
    }
  } catch (error) {
    console.error("Research workflow error:", error);
    throw new Error("Failed to complete research");
  }
}

// Helper functions to extract structured data
function extractFindings(content: string) {
  try {
    // Basic extraction of findings from the content
    return [{
      title: "Research Results",
      content: content,
      source: "Research Agent",
      relevance: "High",
      credibility: "3"
    }];
  } catch {
    return [];
  }
}

function extractReferences(content: string) {
  try {
    // Extract URLs and references from the content
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex) || [];
    
    return urls.map(url => ({
      url,
      title: "Referenced Source",
      publishDate: new Date().toISOString(),
      credibilityScore: "3"
    }));
  } catch {
    return [];
  }
} 