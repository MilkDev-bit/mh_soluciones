import os
import django
import sys
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.tasks.models import TaskSubmission
from apps.documents.models import Document
from apps.tasks.api.serializers import TaskSubmissionSerializer

submissions = TaskSubmission.objects.order_by('-created_at')[:3]

for sub in submissions:
    print(f"Submission ID: {sub.id}, Task: {sub.task.title}")
    # Print the documents relation directly
    docs = sub.documents.all()
    print(f"  Documents related count: {docs.count()}")
    for doc in docs:
        print(f"    - doc ID {doc.id}, file: {doc.file.name}, drive_url: {doc.drive_file_url}")
    # Print the files_metadata
    print(f"  files_metadata: {sub.files_metadata}")
    print(f"  file field: {sub.file}")
    
    # Check serialization
    ser = TaskSubmissionSerializer(sub)
    print(f"  Serialized documents: {len(ser.data.get('documents', []))}")
    print("-" * 50)
