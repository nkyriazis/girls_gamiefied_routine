import type { User, Flow, Reward, Spending, StarTransfer, Chore, ChoreInstance } from '@shared/types';

const API_URL = '/api';

export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, any>;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export const api = {
  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_URL}/users`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },

  getFlows: async (): Promise<Flow[]> => {
    const response = await fetch(`${API_URL}/flows`, { cache: 'no-store' });
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

  getRewards: async (): Promise<Reward[]> => {
    const response = await fetch(`${API_URL}/rewards`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch rewards');
    return response.json();
  },

  getSpendings: async (): Promise<Spending[]> => {
    const response = await fetch(`${API_URL}/spendings`, { cache: 'no-store' });
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

  validateConfig: async (data: any): Promise<ValidationResult> => {
    const response = await fetch(`${API_URL}/admin/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to validate config');
    return response.json();
  },

  validateState: async (data: any): Promise<ValidationResult> => {
    const response = await fetch(`${API_URL}/admin/validate-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to validate state');
    return response.json();
  },

  saveRawData: async (data: any): Promise<void> => {
    const response = await fetch(`${API_URL}/admin/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save data');
    }
  },

  getRawState: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/admin/state`);
    if (!response.ok) throw new Error('Failed to fetch state');
    return response.json();
  },

  getValidationStatus: async (): Promise<{ config: any, state: any }> => {
    const response = await fetch(`${API_URL}/admin/validation-status`);
    if (!response.ok) throw new Error('Failed to fetch validation status');
    return response.json();
  },

  getScheduleDebug: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/debug/schedule`);
    if (!response.ok) throw new Error('Failed to fetch schedule debug info');
    return response.json();
  },

  getDebugLogs: async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/debug/logs`);
    if (!response.ok) throw new Error('Failed to fetch debug logs');
    return response.json();
  },

  saveRawState: async (data: any): Promise<void> => {
    const response = await fetch(`${API_URL}/admin/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save state');
    }
  },

  // Star Transfers API
  getTransfers: async (): Promise<StarTransfer[]> => {
    const response = await fetch(`${API_URL}/transfers`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch transfers');
    return response.json();
  },

  createTransfer: async (fromUserId: string, toUserId: string, amount: number): Promise<StarTransfer> => {
    const response = await fetch(`${API_URL}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUserId, amount }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create transfer');
    }
    return response.json();
  },

  approveTransfer: async (id: string): Promise<StarTransfer> => {
    const response = await fetch(`${API_URL}/transfers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    if (!response.ok) throw new Error('Failed to approve transfer');
    return response.json();
  },

  rejectTransfer: async (id: string): Promise<StarTransfer> => {
    const response = await fetch(`${API_URL}/transfers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    if (!response.ok) throw new Error('Failed to reject transfer');
    return response.json();
  },

  cancelTransfer: async (id: string): Promise<StarTransfer> => {
    const response = await fetch(`${API_URL}/transfers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (!response.ok) throw new Error('Failed to cancel transfer');
    return response.json();
  },

  // Chores API
  getChores: async (userId?: string): Promise<{ chores: Chore[], instances: ChoreInstance[] }> => {
    const url = userId ? `${API_URL}/chores?userId=${userId}` : `${API_URL}/chores`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch chores');
    return response.json();
  },

  claimChore: async (instanceId: string, userId: string): Promise<ChoreInstance> => {
    const response = await fetch(`${API_URL}/chores/${instanceId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to claim chore');
    }
    return response.json();
  },

  attemptChore: async (instanceId: string): Promise<ChoreInstance> => {
    const response = await fetch(`${API_URL}/chores/${instanceId}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark chore as done');
    }
    return response.json();
  },

  confirmChore: async (instanceId: string, stars?: number): Promise<ChoreInstance> => {
    const response = await fetch(`${API_URL}/chores/${instanceId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm chore');
    }
    return response.json();
  },

  rejectChore: async (instanceId: string): Promise<ChoreInstance> => {
    const response = await fetch(`${API_URL}/chores/${instanceId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject chore');
    }
    return response.json();
  }
};
