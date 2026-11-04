-- ====================================================================
-- TMCare - Supabase PostgreSQL Schema & Security Policies (schema.sql)
-- เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส
-- ====================================================================

-- เปิดใช้งาน Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. ตาราง communities (7 ชุมชนในเขต ทต.ตันหยงมัส)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    default_pin VARCHAR(10) NOT NULL,
    lat NUMERIC(10, 6),
    lng NUMERIC(10, 6),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- บันทึกข้อมูลเริ่มต้นทั้ง 7 ชุมชน
INSERT INTO communities (id, name, default_pin, lat, lng, description)
VALUES 
    ('COM-01', 'ชุมชนตลาดกลางผลไม้', '111111', 6.2785, 101.7312, 'พื้นที่เศรษฐกิจและตลาดกลางค้าส่งผลไม้ ตันหยงมัส'),
    ('COM-02', 'ชุมชนโรงเรียนแหลมทองวิทยา', '222222', 6.2742, 101.7348, 'บริเวณใกล้โรงเรียนแหลมทองวิทยา'),
    ('COM-03', 'ชุมชนโรงเรียนเจริญศึกษา', '333333', 6.2721, 101.7325, 'บริเวณโรงเรียนเจริญศึกษาและชุมชนโดยรอบ'),
    ('COM-04', 'ชุมชนวงเวียนลองกอง', '444444', 6.2764, 101.7352, 'จุดศูนย์กลางสัญลักษณ์วงเวียนลองกองตันหยงมัส'),
    ('COM-05', 'ชุมชนโรงภาพยนต์', '555555', 6.2778, 101.7369, 'ย่านชุมชนโรงภาพยนต์เก่าและร้านค้า'),
    ('COM-06', 'ชุมชนสุขาภิบาล', '666666', 6.2798, 101.7340, 'ชุมชนสุขาภิบาลเดิมใจกลางตันหยงมัส'),
    ('COM-07', 'ชุมชนดารุสสลาม', '777777', 6.2705, 101.7380, 'ชุมชนดารุสสลามและมัสยิดในพื้นที่')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- 2. ตาราง beneficiaries (ทะเบียนผู้พิการและกลุ่มเปราะบาง)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beneficiaries (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('BEN-' || substr(md5(random()::text), 1, 8)),
    community_id VARCHAR(20) REFERENCES communities(id) ON DELETE RESTRICT,
    cid_masked VARCHAR(30),
    prefix VARCHAR(20),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    age INT,
    phone VARCHAR(30),
    address TEXT NOT NULL,
    lat NUMERIC(10, 6),
    lng NUMERIC(10, 6),
    vulnerability_type TEXT NOT NULL,
    disability_types JSONB DEFAULT '[]'::jsonb,
    adl_score INT DEFAULT 10,
    triage_level VARCHAR(10) CHECK (triage_level IN ('red', 'yellow', 'green')),
    living_status VARCHAR(20) DEFAULT 'active',
    caregiver_name VARCHAR(150),
    caregiver_phone VARCHAR(50),
    chronic_diseases TEXT,
    drug_allergies TEXT,
    medical_devices TEXT,
    hospital_ref VARCHAR(100) DEFAULT 'รพ.ระแงะ',
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับค้นหาเร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_ben_community ON beneficiaries(community_id);
CREATE INDEX IF NOT EXISTS idx_ben_triage ON beneficiaries(triage_level);

-- --------------------------------------------------------------------
-- 3. ตาราง visit_logs (ประวัติการเยี่ยมบ้าน)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visit_logs (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('VIS-' || substr(md5(random()::text), 1, 8)),
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    community_id VARCHAR(20) REFERENCES communities(id),
    visitor_name VARCHAR(150),
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    health_status TEXT NOT NULL,
    living_condition TEXT,
    notes TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_ben ON visit_logs(beneficiary_id);

-- --------------------------------------------------------------------
-- 4. ตาราง welfare_records (สวัสดิการ กายอุปกรณ์ และคำร้อง)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS welfare_records (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('WEL-' || substr(md5(random()::text), 1, 8)),
    beneficiary_id VARCHAR(50) REFERENCES beneficiaries(id) ON DELETE CASCADE,
    community_id VARCHAR(20) REFERENCES communities(id),
    request_type VARCHAR(50) NOT NULL,
    item_detail TEXT NOT NULL,
    amount VARCHAR(100),
    status VARCHAR(30) DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'delivered', 'rejected')),
    requested_by VARCHAR(150),
    request_date DATE DEFAULT CURRENT_DATE,
    delivery_date DATE,
    notes TEXT,
    approved_by VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 5. ตาราง disaster_statuses (สถานะการดูแลช่วงอุทกภัย/ภัยพิบัติ)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disaster_statuses (
    beneficiary_id VARCHAR(50) PRIMARY KEY REFERENCES beneficiaries(id) ON DELETE CASCADE,
    community_id VARCHAR(20) REFERENCES communities(id),
    evac_status VARCHAR(30) DEFAULT 'safe_at_home' CHECK (evac_status IN ('safe_at_home', 'need_help', 'evacuated')),
    needs_detail TEXT,
    shelter_name VARCHAR(150) DEFAULT '-',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 6. นโยบายความปลอดภัย Row Level Security (RLS)
-- บังคับสิทธิ์ให้คณะกรรมการชุมชนเห็นเฉพาะข้อมูลใน community_id ตนเอง
-- --------------------------------------------------------------------
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE welfare_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE disaster_statuses ENABLE ROW LEVEL SECURITY;

-- นโยบาย: เจ้าหน้าที่ (officer) และผู้บริหาร (executive) เห็นได้ทุกชุมชน
-- ส่วนคณะกรรมการชุมชน (committee) เห็นเฉพาะ community_id ของตน
CREATE POLICY "beneficiaries_community_access" ON beneficiaries
    FOR ALL USING (
        (auth.jwt() ->> 'role') IN ('officer', 'executive')
        OR
        community_id = (auth.jwt() ->> 'community_id')
    );

CREATE POLICY "visit_logs_community_access" ON visit_logs
    FOR ALL USING (
        (auth.jwt() ->> 'role') IN ('officer', 'executive')
        OR
        community_id = (auth.jwt() ->> 'community_id')
    );

CREATE POLICY "welfare_community_access" ON welfare_records
    FOR ALL USING (
        (auth.jwt() ->> 'role') IN ('officer', 'executive')
        OR
        community_id = (auth.jwt() ->> 'community_id')
    );

CREATE POLICY "disaster_community_access" ON disaster_statuses
    FOR ALL USING (
        (auth.jwt() ->> 'role') IN ('officer', 'executive')
        OR
        community_id = (auth.jwt() ->> 'community_id')
    );

