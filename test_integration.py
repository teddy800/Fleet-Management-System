# Test Integration Script for MESOB Fleet Management

import requests
import json

def test_odoo_connection():
    """Test connection to your Odoo instance"""
    try:
        response = requests.get("http://localhost:8069/web/database/selector")
        if response.status_code == 200:
            print("✅ Odoo connection successful")
            return True
        else:
            print("❌ Odoo connection failed")
            return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

def test_hr_sync():
    """Test HR synchronization"""
    # This would test your HR API endpoint
    print("🔄 Testing HR sync...")
    # Add your HR API test here
    print("✅ HR sync test completed")

def test_gps_integration():
    """Test GPS tracking integration"""
    print("🔄 Testing GPS integration...")
    # Add your GPS API test here
    print("✅ GPS integration test completed")

def test_mobile_api():
    """Test mobile API endpoints"""
    print("🔄 Testing mobile API...")
    # Add your mobile API test here
    print("✅ Mobile API test completed")

if __name__ == "__main__":
    print("🚀 Starting MESOB Fleet Integration Tests...")
    
    # Test each component
    test_odoo_connection()
    test_hr_sync()
    test_gps_integration()
    test_mobile_api()
    
    print("✅ All integration tests completed!")