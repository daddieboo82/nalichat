import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 1000 * 30, // 30s — avoid redundant refetches on quick navigation
			gcTime: 1000 * 60 * 10, // keep cached data 10min so back-navigation is instant
		},
	},
});