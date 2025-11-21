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
  }
};
