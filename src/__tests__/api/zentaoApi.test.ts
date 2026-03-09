/// <reference types="jest" />
import axios from 'axios';
import { ZentaoAPI } from '../../api/zentaoApi';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZentaoAPI', () => {
    const config = {
        url: 'https://wzdbsqb.chandao.net',
        username: 'wzdbsqb',
        password: 'wzdbsqb',
        apiVersion: 'v1'
    };

    let api: ZentaoAPI;
    let mockAxiosInstance: any;

    beforeEach(() => {
        mockAxiosInstance = {
            post: jest.fn(),
            request: jest.fn(),
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance);
        api = new ZentaoAPI(config);
    });

    describe('getMyTasks', () => {
        it('should fetch tasks successfully', async () => {
            const mockTasks = {
                tasks: [
                    { id: 1, name: 'Task 1', status: 'doing', pri: 1 },
                    { id: 2, name: 'Task 2', status: 'wait', pri: 2 }
                ]
            };

            mockAxiosInstance.post.mockResolvedValueOnce({
                status: 200,
                data: { token: 'test-token' }
            });
            mockAxiosInstance.request.mockResolvedValueOnce({
                data: mockTasks
            });

            const tasks = await api.getMyTasks();
            expect(tasks).toEqual(mockTasks.tasks);
        });
    });

    describe('getMyBugs', () => {
        it('should fetch bugs successfully', async () => {
            const mockProducts = {
                products: [
                    { id: 1, name: 'Product 1' }
                ]
            };

            const mockBugs = {
                bugs: [
                    { id: 1, title: 'Bug 1', status: 'active', severity: 1, assignedTo: 'wzdbsqb' },
                    { id: 2, title: 'Bug 2', status: 'resolved', severity: 2, assignedTo: 'someone' }
                ]
            };

            mockAxiosInstance.post.mockResolvedValueOnce({
                status: 200,
                data: { token: 'test-token' }
            });
            mockAxiosInstance.request.mockResolvedValueOnce({ data: mockProducts });
            mockAxiosInstance.request.mockResolvedValueOnce({ data: mockBugs });

            const bugs = await api.getMyBugs();
            expect(bugs).toEqual([mockBugs.bugs[0]]);
        });
    });

    describe('finishTask', () => {
        it('should call finish endpoint', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({
                status: 200,
                data: { token: 'test-token' }
            });
            mockAxiosInstance.request.mockResolvedValueOnce({
                data: { id: 1, status: 'done' }
            });

            const result = await api.finishTask(1, { consumed: 1, left: 0, comment: 'done' });

            expect(mockAxiosInstance.request).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: '/tasks/1/finish'
            }));
            expect(result).toEqual({ id: 1, status: 'done' });
        });
    });

    describe('resolveBug', () => {
        it('should call resolve endpoint', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({
                status: 200,
                data: { token: 'test-token' }
            });
            mockAxiosInstance.request.mockResolvedValueOnce({
                data: { id: 2, status: 'resolved' }
            });

            const result = await api.resolveBug(2, { resolution: 'fixed', comment: 'fixed' });

            expect(mockAxiosInstance.request).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: '/bugs/2/resolve'
            }));
            expect(result).toEqual({ id: 2, status: 'resolved' });
        });
    });
});
