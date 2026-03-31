"""初始化 VC 测试数据库"""

import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "vc_test.db")

DDL = """
CREATE TABLE IF NOT EXISTS funds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fund_type TEXT,
    size REAL,
    establishment_date TEXT,
    currency TEXT DEFAULT 'CNY',
    status TEXT
);

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    industry TEXT,
    region TEXT,
    stage TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS fund_investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id INTEGER REFERENCES funds(id),
    company_id INTEGER REFERENCES companies(id),
    amount REAL,
    investment_date TEXT,
    share_pct REAL,
    valuation REAL,
    round TEXT
);

CREATE TABLE IF NOT EXISTS shareholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    shareholder_type TEXT,
    contact_person TEXT,
    commitment_amount REAL
);

CREATE TABLE IF NOT EXISTS fund_shareholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id INTEGER REFERENCES funds(id),
    shareholder_id INTEGER REFERENCES shareholders(id),
    commitment REAL,
    paid_in REAL,
    share_pct REAL,
    join_date TEXT
);

CREATE TABLE IF NOT EXISTS quarterly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id INTEGER REFERENCES funds(id),
    year INTEGER,
    quarter INTEGER,
    total_aum REAL,
    nav REAL,
    return_rate REAL,
    invested_amount REAL,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS financial_statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id),
    year INTEGER,
    quarter INTEGER,
    revenue REAL,
    net_income REAL,
    total_assets REAL,
    total_liabilities REAL,
    employee_count INTEGER
);
"""

SEED_DATA = """
-- 基金 (3 只)
INSERT INTO funds (name, fund_type, size, establishment_date, currency, status) VALUES
('星辰成长基金', 'VC', 10.0, '2021-06-15', 'CNY', '投资中'),
('恒远 PE 基金', 'PE', 25.0, '2020-03-01', 'CNY', '退出期'),
('星曜 FOF', 'FOF', 15.0, '2022-01-10', 'CNY', '募集中');

-- 被投企业 (5 家)
INSERT INTO companies (name, industry, region, stage, status) VALUES
('智能科技', '人工智能', '北京', 'B', '在营'),
('绿能新材', '新能源', '上海', 'C', '在营'),
('云数科技', '云计算', '深圳', 'A', '已上市'),
('量子生物', '生物医药', '苏州', 'Pre-A', '在营'),
('星途导航', '自动驾驶', '北京', 'D', '在营');

-- 投资记录 (20+)
INSERT INTO fund_investments (fund_id, company_id, amount, investment_date, share_pct, valuation, round) VALUES
(1, 1, 0.5, '2021-08-20', 10.0, 5.0, 'B'),
(1, 2, 0.3, '2022-01-15', 8.0, 3.75, 'A'),
(1, 4, 0.1, '2022-06-01', 15.0, 0.67, '天使'),
(1, 5, 0.8, '2023-03-10', 5.0, 16.0, 'C'),
(1, 3, 0.6, '2021-12-05', 3.0, 20.0, 'B'),
(2, 2, 1.5, '2020-09-01', 12.0, 12.5, 'B'),
(2, 3, 2.0, '2021-05-20', 6.0, 33.33, 'A'),
(2, 5, 3.0, '2022-11-15', 4.0, 75.0, 'D'),
(2, 1, 1.0, '2023-01-10', 3.0, 33.33, 'C'),
(3, 1, 0.5, '2022-07-01', 5.0, 10.0, 'B'),
(3, 3, 1.0, '2022-09-15', 2.0, 50.0, 'B'),
(3, 5, 0.8, '2023-02-20', 3.0, 26.67, 'D'),
(1, 2, 0.2, '2023-06-01', 2.0, 10.0, 'B+'),
(2, 4, 0.5, '2023-04-01', 10.0, 5.0, 'Pre-A'),
(3, 4, 0.3, '2023-05-15', 8.0, 3.75, 'Pre-A'),
(1, 5, 0.5, '2024-01-10', 2.0, 25.0, 'D+'),
(2, 1, 0.8, '2024-03-01', 1.5, 53.33, 'C'),
(3, 2, 0.4, '2024-02-15', 2.0, 20.0, 'C'),
(2, 3, 1.5, '2024-06-01', 2.0, 75.0, 'C'),
(1, 4, 0.2, '2024-04-01', 5.0, 4.0, 'A');

-- LP / 股东 (4 个)
INSERT INTO shareholders (name, shareholder_type, contact_person, commitment_amount) VALUES
('国盛保险', '机构', '李明', 20.0),
('鹏程资管', '机构', '王强', 15.0),
('创新母基金', '母基金', '赵芳', 30.0),
('张明', '个人', '张明', 5.0);

-- 基金-LP 关系
INSERT INTO fund_shareholders (fund_id, shareholder_id, commitment, paid_in, share_pct, join_date) VALUES
(1, 1, 4.0, 3.5, 40.0, '2021-06-15'),
(1, 2, 3.0, 2.5, 30.0, '2021-06-20'),
(1, 3, 2.0, 2.0, 20.0, '2021-07-01'),
(1, 4, 1.0, 1.0, 10.0, '2021-07-10'),
(2, 1, 8.0, 7.5, 32.0, '2020-03-01'),
(2, 2, 5.0, 5.0, 20.0, '2020-03-05'),
(2, 3, 10.0, 8.0, 40.0, '2020-03-10'),
(2, 4, 2.0, 2.0, 8.0, '2020-03-15'),
(3, 1, 5.0, 3.0, 33.33, '2022-01-10'),
(3, 2, 4.0, 3.5, 26.67, '2022-01-15'),
(3, 3, 5.0, 4.0, 33.33, '2022-01-20'),
(3, 4, 1.0, 1.0, 6.67, '2022-01-25');

-- 季度报告 (3 基金 x 4 季度 = 12 条)
INSERT INTO quarterly_reports (fund_id, year, quarter, total_aum, nav, return_rate, invested_amount, summary) VALUES
(1, 2024, 1, 10.2, 1.02, 2.0, 3.5, '本季度完成 2 笔新投资，AUM 稳步增长'),
(1, 2024, 2, 10.8, 1.08, 5.9, 4.0, 'AI 赛道表现突出，组合收益增长'),
(1, 2024, 3, 11.5, 1.15, 6.5, 4.8, '新能源企业估值回升，整体表现良好'),
(1, 2024, 4, 12.0, 1.20, 4.3, 5.2, '年末稳健收官，全年收益率超预期'),
(2, 2024, 1, 24.5, 0.98, -2.0, 18.0, '市场波动较大，PE 估值承压'),
(2, 2024, 2, 25.2, 1.008, 2.9, 19.0, '部分被投企业 IPO 临近，估值修复'),
(2, 2024, 3, 26.8, 1.072, 6.3, 20.0, '退出项目收益良好，AUM 大幅增长'),
(2, 2024, 4, 27.0, 1.08, 0.7, 21.0, 'Q4 保持增长，全年表现稳健'),
(3, 2024, 1, 14.8, 0.987, -1.3, 2.0, '建仓初期，FOF 底层基金表现分化'),
(3, 2024, 2, 15.5, 1.033, 4.7, 2.5, '配置优化效果显现，收益转正'),
(3, 2024, 3, 16.0, 1.067, 3.2, 3.0, '持续优化配置，整体表现平稳'),
(3, 2024, 4, 16.5, 1.10, 3.1, 3.2, 'FOF 策略跑赢基准，全年表现符合预期');

-- 企业财务数据 (30+ 条)
INSERT INTO financial_statements (company_id, year, quarter, revenue, net_income, total_assets, total_liabilities, employee_count) VALUES
-- 智能科技 (company_id=1)
(1, 2023, 1, 0.5, 0.05, 2.0, 0.8, 150),
(1, 2023, 2, 0.6, 0.08, 2.1, 0.8, 160),
(1, 2023, 3, 0.7, 0.1, 2.3, 0.9, 180),
(1, 2023, 4, 0.8, 0.12, 2.5, 1.0, 200),
(1, 2024, 1, 0.9, 0.15, 2.8, 1.0, 220),
(1, 2024, 2, 1.1, 0.2, 3.2, 1.2, 250),
(1, 2024, 3, 1.3, 0.25, 3.6, 1.3, 280),
(1, 2024, 4, 1.5, 0.3, 4.0, 1.5, 300),
-- 绿能新材 (company_id=2)
(2, 2023, 1, 1.0, -0.05, 5.0, 3.0, 300),
(2, 2023, 2, 1.2, 0.02, 5.2, 3.0, 310),
(2, 2023, 3, 1.5, 0.1, 5.5, 3.1, 320),
(2, 2023, 4, 1.8, 0.15, 6.0, 3.2, 330),
(2, 2024, 1, 2.0, 0.2, 6.5, 3.3, 350),
(2, 2024, 2, 2.5, 0.35, 7.0, 3.4, 380),
(2, 2024, 3, 3.0, 0.5, 8.0, 3.8, 420),
(2, 2024, 4, 3.5, 0.6, 9.0, 4.0, 450),
-- 云数科技 (company_id=3)
(3, 2023, 1, 2.0, 0.3, 8.0, 3.0, 500),
(3, 2023, 2, 2.3, 0.35, 8.5, 3.1, 520),
(3, 2023, 3, 2.5, 0.4, 9.0, 3.2, 540),
(3, 2023, 4, 2.8, 0.45, 9.5, 3.3, 560),
(3, 2024, 1, 3.2, 0.5, 10.5, 3.5, 600),
(3, 2024, 2, 3.8, 0.65, 11.5, 3.8, 650),
(3, 2024, 3, 4.5, 0.8, 12.5, 4.0, 700),
(3, 2024, 4, 5.0, 0.9, 13.5, 4.2, 750),
-- 量子生物 (company_id=4)
(4, 2023, 2, 0.1, -0.02, 0.5, 0.2, 30),
(4, 2023, 3, 0.12, -0.01, 0.55, 0.2, 35),
(4, 2023, 4, 0.15, 0.0, 0.6, 0.22, 40),
(4, 2024, 1, 0.18, 0.01, 0.7, 0.25, 50),
(4, 2024, 2, 0.22, 0.03, 0.8, 0.28, 55),
(4, 2024, 3, 0.28, 0.05, 0.95, 0.32, 60),
(4, 2024, 4, 0.35, 0.08, 1.1, 0.35, 70),
-- 星途导航 (company_id=5)
(5, 2023, 1, 1.5, 0.2, 10.0, 4.0, 400),
(5, 2023, 2, 1.8, 0.25, 10.5, 4.2, 420),
(5, 2023, 3, 2.0, 0.3, 11.0, 4.3, 450),
(5, 2023, 4, 2.3, 0.35, 11.5, 4.5, 480),
(5, 2024, 1, 2.5, 0.4, 12.0, 4.6, 500),
(5, 2024, 2, 3.0, 0.5, 13.0, 4.8, 550),
(5, 2024, 3, 3.5, 0.6, 14.5, 5.0, 600),
(5, 2024, 4, 4.0, 0.7, 16.0, 5.2, 650);
"""


def init_db(db_path: str | None = None) -> None:
    path = db_path or DB_PATH
    if os.path.exists(path):
        os.remove(path)
    conn = sqlite3.connect(path)
    conn.executescript(DDL)
    conn.executescript(SEED_DATA)
    conn.commit()
    conn.close()
    print(f"Database initialized: {path}")


if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else None
    init_db(db)
