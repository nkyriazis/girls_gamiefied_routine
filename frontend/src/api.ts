import type { User } from './types';
import type { Flow } from './data/flows';

const API_URL = '/api';

export const api = {
  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_URL}/users`);
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },

  getFlows: async (): Promise<Flow[]> => {
    const response = await fetch(`${API_URL}/flows`);
    if (!response.ok) {
      throw new Error('Failed to fetch flows');
    }
    return response.json();
  },

  pushNow: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/hooks/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      throw new Error('Failed to push');
    }
  },
  
  completeTask: async (executionId: string, taskId: string, duration: number, isOnTime: boolean): Promise<{ success: boolean, starsAwarded: number }> => {
    const response = await fetch(`${API_URL}/executions/${executionId}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ duration, isOnTime }),
    });
    if (!response.ok) {
      throw new Error('Failed to complete task');
    }
    return response.json();
  },

  getRewards: async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/rewards`);
    if (!response.ok) throw new Error('Failed to fetch rewards');
    return response.json();
  },

  getSpendings: async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/spendings`);
    if (!response.ok) throw new Error('Failed to fetch spendings');
    return response.json();
  },

  spendStars: async (userId: string, rewardId: string): Promise<any> => {
    const response = await fetch(`${API_URL}/spendings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, rewardId }),
    });
    if (!response.ok) throw new Error('Failed to spend stars');
    return response.json();
  },

  markSpendingDone: async (id: string): Promise<any> => {
    const response = await fetch(`${API_URL}/spendings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    if (!response.ok) throw new Error('Failed to update spending');
    return response.json();
  },

  revokeSpending: async (id: string): Promise<any> => {
    const response = await fetch(`${API_URL}/spendings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revoked' }),
    });
    if (!response.ok) throw new Error('Failed to revoke spending');
    return response.json();
  },

  uploadFile: async (file: File): Promise<{ success: boolean, url: string, filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/admin/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  getRawData: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/admin/data`);
    if (!response.ok) throw new Error('Failed to fetch data');
    return response.json();
  },

  saveRawData: async (data: any): Promise<void> => {
    const response = await fetch(`${API_URL}/admin/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to save data');
  },

  getRawState: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/admin/state`);
    if (!response.ok) throw new Error('Failed to fetch state');
    return response.json();
  },

  saveRawState: async (data: any): Promise<void> => {
    const response = await fetch(`${API_URL}/admin/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to save state');
  }
};
