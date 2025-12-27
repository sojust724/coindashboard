interface CandleData {
	market: string;
	candle_date_time_utc: string;
	candle_date_time_kst: string;
	opening_price: number;
	high_price: number;
	low_price: number;
	trade_price: number;
	timestamp: number;
	candle_acc_trade_price: number;
	candle_acc_trade_volume: number;
	prev_closing_price: number;
	change_price: number;
	change_rate: number;
}

interface CoinMetrics {
	symbol: string;
	name: string;
	currentPrice: number;
	volume24h: number;
	rsi: number;
	changeRate: number;
}

async function fetchUpbitCandles(market: string, count: number = 14): Promise<CandleData[]> {
	const url = `https://api.upbit.com/v1/candles/minutes/60?market=${market}&count=${count}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${market}: ${response.statusText}`);
	}

	return response.json();
}

function calculateRSI(candles: CandleData[], period: number = 14): number {
	if (candles.length < period + 1) {
		return 0;
	}

	const changes: number[] = [];
	for (let i = candles.length - 1; i > 0; i--) {
		const change = candles[i - 1].trade_price - candles[i].trade_price;
		changes.push(change);
	}

	const gains = changes.slice(0, period).map(c => c > 0 ? c : 0);
	const losses = changes.slice(0, period).map(c => c < 0 ? Math.abs(c) : 0);

	const avgGain = gains.reduce((a, b) => a + b, 0) / period;
	const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

	if (avgLoss === 0) {
		return 100;
	}

	const rs = avgGain / avgLoss;
	const rsi = 100 - (100 / (1 + rs));

	return Math.round(rsi * 100) / 100;
}

async function getCoinMetrics(markets: string[]): Promise<CoinMetrics[]> {
	const metricsPromises = markets.map(async (market) => {
		try {
			const candles = await fetchUpbitCandles(market, 30);

			if (candles.length === 0) {
				return null;
			}

			const latestCandle = candles[0];
			const rsi = calculateRSI(candles);

			return {
				symbol: market,
				name: market.replace('KRW-', ''),
				currentPrice: latestCandle.trade_price,
				volume24h: latestCandle.candle_acc_trade_price,
				rsi: rsi,
				changeRate: latestCandle.change_rate * 100,
			};
		} catch (error) {
			console.error(`Error fetching ${market}:`, error);
			return null;
		}
	});

	const results = await Promise.all(metricsPromises);
	return results.filter((m): m is CoinMetrics => m !== null);
}

function generateHTML(coins: CoinMetrics[], sortBy: string = 'volume'): string {
	let sortedCoins = [...coins];

	if (sortBy === 'rsi') {
		sortedCoins.sort((a, b) => b.rsi - a.rsi);
	} else {
		sortedCoins.sort((a, b) => b.volume24h - a.volume24h);
	}

	const rows = sortedCoins.map((coin, index) => {
		const rsiColor = coin.rsi >= 70 ? '#ef4444' : coin.rsi <= 30 ? '#3b82f6' : '#64748b';
		const changeColor = coin.changeRate >= 0 ? '#10b981' : '#ef4444';

		return `
			<tr style="border-bottom: 1px solid #e2e8f0;">
				<td style="padding: 16px; text-align: center; font-weight: 500;">${index + 1}</td>
				<td style="padding: 16px; font-weight: 600; color: #1e293b;">${coin.name}</td>
				<td style="padding: 16px; text-align: right; font-family: 'Courier New', monospace;">
					${coin.currentPrice.toLocaleString('ko-KR')} KRW
				</td>
				<td style="padding: 16px; text-align: right; font-family: 'Courier New', monospace;">
					${Math.round(coin.volume24h / 1000000).toLocaleString('ko-KR')}M
				</td>
				<td style="padding: 16px; text-align: center;">
					<span style="
						display: inline-block;
						padding: 6px 12px;
						border-radius: 6px;
						background-color: ${rsiColor}22;
						color: ${rsiColor};
						font-weight: 600;
						font-family: 'Courier New', monospace;
					">
						${coin.rsi.toFixed(2)}
					</span>
				</td>
				<td style="padding: 16px; text-align: right; color: ${changeColor}; font-weight: 600; font-family: 'Courier New', monospace;">
					${coin.changeRate >= 0 ? '+' : ''}${coin.changeRate.toFixed(2)}%
				</td>
			</tr>
		`;
	}).join('');

	return `
		<!DOCTYPE html>
		<html lang="ko">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>코인 지표 대시보드</title>
			<style>
				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}

				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					min-height: 100vh;
					padding: 20px;
				}

				.container {
					max-width: 1200px;
					margin: 0 auto;
				}

				.header {
					background: white;
					padding: 30px;
					border-radius: 16px;
					box-shadow: 0 10px 30px rgba(0,0,0,0.1);
					margin-bottom: 20px;
					text-align: center;
				}

				h1 {
					color: #1e293b;
					font-size: 32px;
					margin-bottom: 10px;
				}

				.subtitle {
					color: #64748b;
					font-size: 14px;
				}

				.controls {
					background: white;
					padding: 20px;
					border-radius: 12px;
					box-shadow: 0 4px 12px rgba(0,0,0,0.05);
					margin-bottom: 20px;
					display: flex;
					gap: 10px;
					justify-content: center;
					flex-wrap: wrap;
				}

				.btn {
					padding: 10px 24px;
					border: none;
					border-radius: 8px;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.2s;
					font-size: 14px;
					text-decoration: none;
					display: inline-block;
				}

				.btn-primary {
					background: #667eea;
					color: white;
				}

				.btn-primary:hover {
					background: #5568d3;
					transform: translateY(-1px);
				}

				.btn-secondary {
					background: #764ba2;
					color: white;
				}

				.btn-secondary:hover {
					background: #5f3d82;
					transform: translateY(-1px);
				}

				.table-container {
					background: white;
					border-radius: 16px;
					box-shadow: 0 10px 30px rgba(0,0,0,0.1);
					overflow: hidden;
				}

				table {
					width: 100%;
					border-collapse: collapse;
				}

				thead {
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					color: white;
				}

				th {
					padding: 16px;
					text-align: left;
					font-weight: 600;
					font-size: 14px;
					text-transform: uppercase;
					letter-spacing: 0.5px;
				}

				tr:hover {
					background-color: #f8fafc;
				}

				.update-time {
					text-align: center;
					color: white;
					margin-top: 20px;
					font-size: 14px;
					opacity: 0.9;
				}

				@media (max-width: 768px) {
					.table-container {
						overflow-x: auto;
					}

					table {
						font-size: 12px;
					}

					th, td {
						padding: 10px 8px !important;
					}
				}
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>📊 코인 지표 대시보드</h1>
					<div class="subtitle">실시간 거래량 & RSI 분석</div>
				</div>

				<div class="controls">
					<a href="/?sort=volume" class="btn btn-primary">💰 거래량순 정렬</a>
					<a href="/?sort=rsi" class="btn btn-secondary">📈 RSI순 정렬</a>
				</div>

				<div class="table-container">
					<table>
						<thead>
							<tr>
								<th style="text-align: center; width: 60px;">#</th>
								<th>코인</th>
								<th style="text-align: right;">현재가</th>
								<th style="text-align: right;">거래대금(24h)</th>
								<th style="text-align: center;">RSI(14)</th>
								<th style="text-align: right;">변동률</th>
							</tr>
						</thead>
						<tbody>
							${rows}
						</tbody>
					</table>
				</div>

				<div class="update-time">
					마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
				</div>
			</div>
		</body>
		</html>
	`;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			const url = new URL(request.url);
			const sortBy = url.searchParams.get('sort') || 'volume';

			const topMarkets = [
				'KRW-BTC',
				'KRW-ETH',
				'KRW-XRP',
				'KRW-SOL',
				'KRW-DOGE',
				'KRW-ADA',
				'KRW-AVAX',
				'KRW-SHIB',
				'KRW-MATIC',
				'KRW-DOT',
				'KRW-TRX',
				'KRW-LINK',
				'KRW-BCH',
				'KRW-NEAR',
				'KRW-UNI',
			];

			const coins = await getCoinMetrics(topMarkets);
			const html = generateHTML(coins, sortBy);

			return new Response(html, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'public, max-age=60',
				},
			});
		} catch (error) {
			return new Response(`Error: ${error}`, {
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
			});
		}
	},
} satisfies ExportedHandler<Env>;
