#!/bin/bash
#
# PostgreSQL Database Viewer Tool
# Comprehensive database inspection and query tool
#

CONTAINER="idii-db-staging"
DB_USER="postgres"
DB_NAME="productdb-staging"

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if container is running
check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        echo -e "${RED}ERROR: Container ${CONTAINER} is not running!${NC}"
        echo "Start it with: docker-compose -f docker-compose.staging.yml up -d db-staging"
        exit 1
    fi
}

# Select content to view using parameters
case "$1" in
    "tables"|"t")
        check_container
        echo "📋 All Tables:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "\dt"
        ;;

    "users"|"u")
        check_container
        echo "👥 User List:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT id, username, email, is_active, created_at
        FROM users
        ORDER BY created_at DESC;"
        ;;

    "sessions"|"s")
        check_container
        echo "💬 Chat Sessions:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            cs.id,
            cs.user_id,
            u.username,
            cs.session_name,
            (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id) as msgs,
            cs.created_at
        FROM chat_sessions cs
        LEFT JOIN users u ON cs.user_id = u.id
        ORDER BY cs.created_at DESC
        LIMIT 10;"
        ;;

    "messages"|"m")
        check_container
        echo "💬 Recent Chat Messages:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            cm.id,
            cm.session_id,
            cm.sender,
            LEFT(cm.message_text, 80) as message_preview,
            cm.created_at
        FROM chat_messages cm
        ORDER BY cm.created_at DESC
        LIMIT 15;"
        ;;

    "resumes"|"r")
        check_container
        echo "📄 Resume List:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            r.id,
            r.user_id,
            u.username,
            r.filename,
            r.upload_date,
            pg_size_pretty(LENGTH(r.file_content)) as file_size
        FROM resumes r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.upload_date DESC;"
        ;;

    "insights"|"i")
        check_container
        echo "🎯 Career Insights:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            ci.id,
            ci.user_id,
            u.username,
            LEFT(ci.insight_text, 100) as insight,
            ci.created_at
        FROM career_insights ci
        LEFT JOIN users u ON ci.user_id = u.id
        ORDER BY ci.created_at DESC;"
        ;;

    "activities"|"a")
        check_container
        echo "📊 User Activities:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            ua.id,
            ua.user_id,
            u.username,
            ua.activity_type,
            ua.created_at
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = u.id
        ORDER BY ua.created_at DESC
        LIMIT 15;"
        ;;

    "recommendations"|"rec")
        check_container
        echo "💡 Daily Recommendations:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            dr.id,
            dr.user_id,
            u.username,
            LEFT(dr.recommendation_text, 60) || '...' as recommendation_preview,
            dr.created_at
        FROM daily_recommendations dr
        LEFT JOIN users u ON dr.user_id = u.id
        ORDER BY dr.created_at DESC;"
        ;;

    "stats"|"st")
        check_container
        echo "📊 Database Statistics:"
        echo ""
        echo "Record Count Statistics:"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT 'users' as table_name, COUNT(*) FROM users
        UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
        UNION ALL SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
        UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
        UNION ALL SELECT 'resumes', COUNT(*) FROM resumes
        UNION ALL SELECT 'user_activities', COUNT(*) FROM user_activities
        UNION ALL SELECT 'career_insights', COUNT(*) FROM career_insights
        UNION ALL SELECT 'daily_recommendations', COUNT(*) FROM daily_recommendations
        ORDER BY count DESC;"

        echo ""
        echo "Table Size Statistics (with indexes):"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
            pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
        ;;

    "dbinfo"|"db")
        check_container
        echo "🔍 Database Overview:"
        docker exec $CONTAINER psql -U $DB_USER -c "
        SELECT
            pg_database.datname as database_name,
            pg_size_pretty(pg_database_size(pg_database.datname)) as size,
            (SELECT count(*) FROM pg_stat_activity WHERE datname = pg_database.datname) as active_connections,
            (SELECT count(*) FROM pg_stat_activity WHERE datname = pg_database.datname AND state = 'active') as active_queries
        FROM pg_database
        WHERE datname = '${DB_NAME}';"
        ;;

    "structure"|"str")
        check_container
        if [ -z "$2" ]; then
            echo "Usage: $0 structure <table_name>"
            echo "Example: $0 structure users"
        else
            echo "🔍 Table Structure: $2"
            docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "\d $2"
        fi
        ;;

    "columns"|"col")
        check_container
        if [ -z "$2" ]; then
            echo "Usage: $0 columns <table_name>"
            echo "Example: $0 columns users"
        else
            echo "📋 Columns for table: $2"
            docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
            SELECT
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = '$2'
            ORDER BY ordinal_position;"
        fi
        ;;

    "sql")
        check_container
        if [ -z "$2" ]; then
            echo "Usage: $0 sql \"SELECT * FROM users LIMIT 5;\""
        else
            docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "$2"
        fi
        ;;

    "cli"|"c")
        check_container
        echo "Entering PostgreSQL CLI..."
        echo "Tip: Use \dt to list tables, \d <table> for structure, \q to exit"
        docker exec -it $CONTAINER psql -U $DB_USER $DB_NAME
        ;;

    "backup"|"bak")
        check_container
        BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
        echo "Creating backup: $BACKUP_FILE"
        docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE"
        echo -e "${GREEN}Backup completed: $BACKUP_FILE${NC}"
        ls -lh "$BACKUP_FILE"
        ;;

    "all")
        check_container
        echo "=================================================="
        echo "PostgreSQL Database Complete Overview"
        echo "=================================================="
        echo ""

        echo "🔍 Database Info:"
        echo "--------------------------------------------------"
        $0 dbinfo
        echo ""
        echo "=================================================="

        $0 stats
        echo ""
        echo "=================================================="

        echo "👥 Recent Users (Top 5):"
        echo "--------------------------------------------------"
        docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "
        SELECT id, username, email, created_at, is_active
        FROM users
        ORDER BY created_at DESC
        LIMIT 5;"
        echo ""
        echo "=================================================="

        $0 sessions
        echo ""
        echo "=================================================="

        $0 messages
        echo ""
        echo "=================================================="

        echo "📄 Recent Resumes:"
        echo "--------------------------------------------------"
        $0 resumes
        echo ""
        echo "=================================================="
        ;;

    "help"|"h"|"-h"|"--help")
        echo "PostgreSQL Database Viewer Tool"
        echo ""
        echo "Usage: $0 <command> [arguments]"
        echo ""
        echo "Available Commands:"
        echo "  tables, t              - View all tables"
        echo "  users, u               - View user list"
        echo "  sessions, s            - View chat sessions"
        echo "  messages, m            - View chat messages"
        echo "  resumes, r             - View resume list (with file sizes)"
        echo "  insights, i            - View career insights"
        echo "  activities, a          - View user activities"
        echo "  recommendations, rec   - View daily recommendations"
        echo "  stats, st              - View database statistics (records & sizes)"
        echo "  dbinfo, db             - View database overview (size & connections)"
        echo "  structure, str         - View table structure (requires table name)"
        echo "  columns, col           - View table columns (requires table name)"
        echo "  sql                    - Execute custom SQL query"
        echo "  cli, c                 - Enter interactive CLI mode"
        echo "  backup, bak            - Create database backup"
        echo "  all                    - View complete overview"
        echo "  help, h                - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 users                      # View all users"
        echo "  $0 stats                      # View statistics"
        echo "  $0 dbinfo                     # View database info"
        echo "  $0 structure users            # View users table structure"
        echo "  $0 columns users              # View users table columns"
        echo "  $0 sql \"SELECT * FROM users;\"  # Execute SQL query"
        echo "  $0 cli                        # Enter interactive mode"
        echo "  $0 backup                     # Create backup"
        echo "  $0 all                        # View everything"
        echo ""
        echo "Tips:"
        echo "  - Use short aliases for faster access (t, u, s, m, r, i, a, st, db, str, col, c)"
        echo "  - Interactive CLI mode gives full PostgreSQL access"
        echo "  - Custom SQL can be executed with the 'sql' command"
        ;;

    *)
        echo -e "${YELLOW}Unknown command: $1${NC}"
        echo ""
        echo "PostgreSQL Database Viewer Tool"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Run '$0 help' for full command list"
        echo ""
        echo "Quick Commands:"
        echo "  $0 all      - View complete overview"
        echo "  $0 stats    - View statistics"
        echo "  $0 users    - View users"
        echo "  $0 cli      - Interactive mode"
        echo "  $0 help     - Full help"
        ;;
esac
