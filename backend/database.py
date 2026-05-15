from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, func
from sqlalchemy.orm import declarative_base, sessionmaker
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agropulse.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Article(Base):
    __tablename__ = "articles"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(2048), unique=True, index=True, nullable=False)
    title = Column(String(512), nullable=False)
    source = Column(String(128))
    published_at = Column(DateTime)
    content = Column(Text)
    summary = Column(Text)
    fetched_at = Column(DateTime, server_default=func.now())
    analyzed = Column(Boolean, default=False)


class ArticleSentiment(Base):
    __tablename__ = "article_sentiments"
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, index=True, nullable=False)
    commodity = Column(String(64), index=True, nullable=False)
    sentiment = Column(String(16), nullable=False)
    confidence = Column(Float, default=0.7)
    reasoning = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class MarketReport(Base):
    __tablename__ = "market_reports"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512))
    analyzed_at = Column(DateTime, server_default=func.now())
    data_json = Column(Text, nullable=False)


class ProcessedEmailId(Base):
    __tablename__ = "processed_email_ids"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(512), unique=True, index=True, nullable=False)
    processed_at = Column(DateTime, server_default=func.now())


class PulseEmailReport(Base):
    __tablename__ = "pulse_email_reports"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512))
    sender = Column(String(256), nullable=True)
    email_date = Column(String(64), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())
    data_json = Column(Text, nullable=False)


class PriceEntry(Base):
    __tablename__ = "price_entries"
    id = Column(Integer, primary_key=True, index=True)
    commodity = Column(String(64), index=True, nullable=False)
    origin = Column(String(128), nullable=False)
    destination = Column(String(128), nullable=False)
    price = Column(Float, nullable=False)
    trade_type = Column(String(16), nullable=False)   # buy | sell | indicative
    cargo_type = Column(String(16), nullable=False)   # bulk | container
    date = Column(String(10), nullable=False)          # YYYY-MM-DD
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
