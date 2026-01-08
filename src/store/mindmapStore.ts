import { create } from 'zustand';
import { MindmapStore, MindmapData } from '@/types/mindmap';
import { MermaidParser } from '@/lib/mermaidParser';

export const useMindmapStore = create<MindmapStore>((set, get) => ({
  mindmapData: null,
  selectedNodeId: null,
  mermaidInput: `flowchart TD
    A[Node A]
    B[Node B]
    C[Node C]
    D[Node D]
    E[Node E]
    A -.->|条件 1| B
    A -->|条件 2| C
    A -->|条件 3| D
    B --> E
  `,

  setMindmapData: (data: MindmapData) => 
    set({ mindmapData: data }),

  setSelectedNode: (nodeId: string | null) => 
    set({ selectedNodeId: nodeId }),

  setMermaidInput: (input: string) => 
    set({ mermaidInput: input }),

  parseMermaidToMindmap: (mermaidText: string) => {
    try {
      console.log('Parsing Mermaid text:', mermaidText);
      const mindmapData = MermaidParser.parseMindmap(mermaidText);
      console.log('Parsed mindmap data:', mindmapData);
      set({ mindmapData, mermaidInput: mermaidText });
    } catch (error) {
      console.error('Mermaid parsing error:', error);
    }
  },

  parseMermaidForNodeData: (mermaidText: string) => {
    try {
      const mindmapData = MermaidParser.parseMindmap(mermaidText);
      set({ mindmapData });
    } catch (error) {
      console.error('Mermaid node data parsing error:', error);
    }
  }
}));